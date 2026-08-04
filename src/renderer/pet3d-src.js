// 3D 宠物渲染器：加载用户导入的 GLB 模型
// 通过 esbuild 打包成 pet3d.js（含 three + GLTFLoader），暴露 window.__Pet3D
import * as THREE from 'three';
import { GLTFLoader } from './vendor/GLTFLoader.js';

class Pet3D {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = false;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.inset = '0';

    this.scene = new THREE.Scene();
    const amb = new THREE.AmbientLight(0xffffff, 0.75);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(4, 7, 5);
    const fill = new THREE.DirectionalLight(0xffeedd, 0.35);
    fill.position.set(-4, 2, -3);
    this.scene.add(amb, dir, fill);

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this.camera.position.set(0, 1, 8);
    this.camera.lookAt(0, 0, 0);
    this.camDist = this.camera.position.length();

    this.raycaster = new THREE.Raycaster();
    this.model = new THREE.Group();
    this.scene.add(this.model);
    this.mixer = null;
    this.clipActions = [];
    this.anim = 'idle';
    this.animTime = 0;
    this.facing = 1;
    this.fitScale = 1;
    this.baseScale = 1;
    this.resize();
    this.loopId = null;
    this.running = true;
    this.loop();
    // 容器尺寸变化时同步渲染器与相机（跟随宠物窗口尺寸）
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(() => this.resize());
      this._ro.observe(container);
    }
  }

  resize() {
    const w = Math.max(this.container.clientWidth || 120, 40);
    const h = Math.max(this.container.clientHeight || 110, 40);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // 适配：把 model 缩放到相机视野内（高度占可视区 ~72%）
  fitModel() {
    const box = new THREE.Box3().setFromObject(this.model);
    if (box.isEmpty()) return;
    const size = new THREE.Vector3();
    box.getSize(size);
    const target = 2 * this.camDist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 0.72;
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    this.fitScale = target / maxDim;
    // 居中并让脚底贴地（y=0）
    const center = new THREE.Vector3();
    box.getCenter(center);
    this.model.scale.setScalar(this.fitScale);
    this.model.position.x = -center.x * this.fitScale;
    this.model.position.z = -center.z * this.fitScale;
    this.model.position.y = -box.min.y * this.fitScale;
    this.baseScale = this.fitScale;
  }

  clearModel() {
    while (this.model.children.length) {
      const c = this.model.children.pop();
      c.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        materials.filter(Boolean).forEach((material) => {
          Object.values(material).forEach((value) => {
            if (value && value.isTexture) value.dispose();
          });
          material.dispose();
        });
      });
    }
    if (this.mixer) { this.mixer.stopAllAction(); this.mixer = null; }
    this.clipActions = [];
    this.anim = 'idle';
    this.animTime = 0;
  }

  loadGlb(arrayBuffer, onProgress) {
    this.clearModel();
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.parse(arrayBuffer, '', (gltf) => {
        const root = gltf.scene || gltf.scenes[0];
        if (!root) return reject(new Error('GLB 场景为空'));
        // 归一到 -Z 正面朝向相机
        root.rotation.y = 0;
        this.model.add(root);
        if (gltf.animations && gltf.animations.length) {
          this.mixer = new THREE.AnimationMixer(root);
          this.clipActions = gltf.animations.map((a) => this.mixer.clipAction(a));
          this.clipActions.forEach((a) => a.play());
        }
        this.fitModel();
        resolve();
      }, onProgress, (err) => reject(err));
    });
  }

  // ---- 动画控制（与 2D 引擎同名钩子） ----
  play(name) {
    this.anim = name;
    this.animTime = 0;
    if (this.clipActions.length && name === 'idle') {
      this.clipActions.forEach((a) => a.play());
    }
  }

  setFacing(dir) {
    this.facing = dir < 0 ? -1 : 1;
  }

  update(dt) {
    this.animTime += dt;
    // GLB 自带动画
    if (this.mixer) {
      this.mixer.update(dt);
    }
    if (!this.model) return;
    const t = this.animTime;
    let sx = 1, sy = 1, ry = 0, yoff = 0, rz = 0;
    switch (this.anim) {
      case 'idle':
        sy = 1 + Math.sin(t * 2.2) * 0.025;
        sx = 1 - Math.sin(t * 2.2) * 0.02;
        ry = Math.sin(t * 0.9) * 0.04;
        break;
      case 'happy':
        yoff = Math.abs(Math.sin(t * 6)) * 0.35;
        ry = Math.sin(t * 3) * 0.12;
        break;
      case 'sad':
        rz = -0.1;
        sy = 0.98;
        break;
      case 'eat':
        yoff = Math.sin(t * 8) * 0.06;
        sx = 1 + Math.sin(t * 8) * 0.06;
        sy = 1 - Math.sin(t * 8) * 0.06;
        break;
      case 'talk':
        sy = 1 + Math.sin(t * 12) * 0.04;
        break;
      case 'drag':
        sx = 1.08;
        sy = 0.92;
        ry = Math.sin(t * 10) * 0.08;
        break;
      case 'walk':
        yoff = Math.abs(Math.sin(t * 7)) * 0.12;
        rz = Math.sin(t * 7) * 0.06;
        break;
      case 'blink':
        sy = 1 + Math.sin(t * 14) * 0.03;
        break;
      default:
        break;
    }
    if (!this.clipActions.length && this.anim === 'idle') yoff = Math.sin(t * 1.4) * 0.05;
    if (this.baseScale) {
      this.model.scale.set(this.baseScale * sx, this.baseScale * sy, this.baseScale);
      this.model.rotation.y = ry * this.facing;
      this.model.rotation.z = rz;
      this.model.position.y = (this.model.userData.baseY || 0) + yoff;
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  loop() {
    if (!this.running) return;
    requestAnimationFrame(() => {
      this.update(1 / 60);
      this.render();
      this.loop();
    });
  }

  stop() {
    this.running = false;
  }

  // 射线命中检测：用于透明窗口点击穿透判断
  hitTest(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera({ x: ndcX, y: ndcY }, this.camera);
    const hits = this.raycaster.intersectObject(this.model, true);
    return hits.length > 0;
  }

  dispose() {
    this.stop();
    if (this._ro) { try { this._ro.disconnect(); } catch (e) { /* ignore */ } this._ro = null; }
    this.clearModel();
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}

window.__Pet3D = { Pet3D };
export { Pet3D };
