class Carrito {
  constructor() {
    this.items = [];
  }

  agregar(nombre, precio, cantidad = 1) {
    this.items.push({ nombre, precio, cantidad });
  }

  total() {
    return this.items.reduce((suma, i) => suma + i.precio * i.cantidad, 0);
  }
}

module.exports = Carrito;
