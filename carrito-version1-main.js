/**
 * Carrito de compras.
 * Los cupones se describen con datos (tipo y valor), nunca con código ejecutable.
 */
const TIPOS_CUPON = Object.freeze({
  PORCENTAJE: "porcentaje",
  MONTO: "monto",
});

class Carrito {
  #items = [];
  #cupon = null;

  /**
   * Agrega un producto. Si ya existe uno con el mismo nombre y precio,
   * suma la cantidad en lugar de duplicar la línea.
   * @param {string} nombre
   * @param {number} precio   Precio unitario, mayor o igual a 0.
   * @param {number} [cantidad=1]  Entero mayor o igual a 1.
   */
  agregar(nombre, precio, cantidad = 1) {
    if (typeof nombre !== "string" || nombre.trim() === "") {
      throw new TypeError("El nombre debe ser un texto no vacío.");
    }
    if (!Number.isFinite(precio) || precio < 0) {
      throw new RangeError("El precio debe ser un número mayor o igual a 0.");
    }
    if (!Number.isInteger(cantidad) || cantidad < 1) {
      throw new RangeError("La cantidad debe ser un entero mayor o igual a 1.");
    }

    const nombreLimpio = nombre.trim();
    const existente = this.#items.find(
      (i) => i.nombre === nombreLimpio && i.precio === precio
    );
    if (existente) {
      existente.cantidad += cantidad;
    } else {
      this.#items.push({ nombre: nombreLimpio, precio, cantidad });
    }
  }

  /**
   * Aplica un cupón de descuento.
   * @param {{tipo: "porcentaje" | "monto", valor: number}} cupon
   *   - porcentaje: valor entre 0 (sin incluir) y 100.
   *   - monto: valor mayor que 0, en la misma moneda del carrito.
   */
  aplicarCupon(cupon) {
    if (cupon === null || typeof cupon !== "object") {
      throw new TypeError("El cupón debe ser un objeto { tipo, valor }.");
    }
    const { tipo, valor } = cupon;
    if (!Number.isFinite(valor) || valor <= 0) {
      throw new RangeError("El valor del cupón debe ser mayor que 0.");
    }
    if (tipo === TIPOS_CUPON.PORCENTAJE) {
      if (valor > 100) throw new RangeError("El porcentaje no puede superar 100.");
    } else if (tipo !== TIPOS_CUPON.MONTO) {
      throw new TypeError(`Tipo de cupón no válido: "${tipo}".`);
    }
    this.#cupon = { tipo, valor };
  }

  quitarCupon() {
    this.#cupon = null;
  }

  /** Copia de solo lectura de los productos del carrito. */
  get items() {
    return this.#items.map((i) => ({ ...i }));
  }

  subtotal() {
    return redondear(
      this.#items.reduce((suma, i) => suma + i.precio * i.cantidad, 0)
    );
  }

  /** Descuento aplicado. Nunca supera el subtotal. */
  descuento() {
    if (!this.#cupon) return 0;
    const subtotal = this.subtotal();
    const bruto =
      this.#cupon.tipo === TIPOS_CUPON.PORCENTAJE
        ? (subtotal * this.#cupon.valor) / 100
        : this.#cupon.valor;
    return redondear(Math.min(bruto, subtotal));
  }

  total() {
    return redondear(this.subtotal() - this.descuento());
  }
}

/** Evita errores de punto flotante (0.1 + 0.2) redondeando a 2 decimales. */
function redondear(valor) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

module.exports = Carrito;
module.exports.TIPOS_CUPON = TIPOS_CUPON;
