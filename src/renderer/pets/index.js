const cat = require('./cat.js');

const registry = {
  cat,
};

function list() {
  return Object.values(registry).map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
  }));
}

function get(id) {
  return registry[id] || cat;
}

module.exports = { list, get, registry };
