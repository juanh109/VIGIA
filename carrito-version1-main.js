class Carrito {
  constructor() {
    this.items = [];
    this.cupon = null;
  }

  agregar(n, p, c) {
    this.items.push({ nombre: n, precio: p, cantidad: c });
  }

  aplicarCupon(codigo) {
    // el cupón llega como fórmula, ej: "total * 0.9"
    this.cupon = codigo;
  }

  total() {
    var total = 0;
    for (var i = 0; i < this.items.length; i++) {
      total = total + this.items[i].precio * this.items[i].cantidad;
    }
    if (this.cupon) {
      total = eval(this.cupon.replace("total", total));
    }
    return total;
  }
}

module.exports = Carrito;
