const test = require("node:test");
const assert = require("node:assert/strict");

// Si renombras el archivo a carrito.js, cambia solo esta línea por require("./carrito")
const Carrito = require("./carrito-version1-main");

// --- Casos básicos ---------------------------------------------------------

test("un carrito vacío vale 0", () => {
  assert.equal(new Carrito().total(), 0);
});

test("calcula el total con varias líneas", () => {
  const c = new Carrito();
  c.agregar("Aceite", 25000, 2);
  c.agregar("Filtro", 18000);
  assert.equal(c.total(), 68000);
});

test("suma la cantidad si el producto ya existe", () => {
  const c = new Carrito();
  c.agregar("Aceite", 25000);
  c.agregar("Aceite", 25000, 2);
  assert.equal(c.items.length, 1);
  assert.equal(c.items[0].cantidad, 3);
});

// --- Casos límite de agregar -----------------------------------------------

test("acepta un producto con precio 0", () => {
  const c = new Carrito();
  c.agregar("Obsequio", 0);
  assert.equal(c.total(), 0);
  assert.equal(c.items.length, 1);
});

test("rechaza cantidad no entera, cero o negativa", () => {
  const c = new Carrito();
  assert.throws(() => c.agregar("X", 100, 1.5), RangeError);
  assert.throws(() => c.agregar("X", 100, 0), RangeError);
  assert.throws(() => c.agregar("X", 100, -2), RangeError);
});

test("rechaza nombre vacío y precio inválido", () => {
  const c = new Carrito();
  assert.throws(() => c.agregar("", 100), TypeError);
  assert.throws(() => c.agregar("   ", 100), TypeError);
  assert.throws(() => c.agregar("X", -1), RangeError);
  assert.throws(() => c.agregar("X", NaN), RangeError);
  assert.throws(() => c.agregar("X", Infinity), RangeError);
});

// --- Cupones ---------------------------------------------------------------

test("cupón por porcentaje", () => {
  const c = new Carrito();
  c.agregar("Aceite", 100000);
  c.aplicarCupon({ tipo: "porcentaje", valor: 10 });
  assert.equal(c.descuento(), 10000);
  assert.equal(c.total(), 90000);
});

test("cupón del 100% deja el total en 0", () => {
  const c = new Carrito();
  c.agregar("Aceite", 100000);
  c.aplicarCupon({ tipo: "porcentaje", valor: 100 });
  assert.equal(c.total(), 0);
});

test("rechaza porcentaje mayor a 100", () => {
  const c = new Carrito();
  assert.throws(() => c.aplicarCupon({ tipo: "porcentaje", valor: 100.01 }), RangeError);
  assert.throws(() => c.aplicarCupon({ tipo: "porcentaje", valor: 150 }), RangeError);
});

test("cupón por monto fijo", () => {
  const c = new Carrito();
  c.agregar("Aceite", 100000);
  c.aplicarCupon({ tipo: "monto", valor: 15000 });
  assert.equal(c.total(), 85000);
});

test("un monto mayor al subtotal no deja el total negativo", () => {
  const c = new Carrito();
  c.agregar("Filtro", 10000);
  c.aplicarCupon({ tipo: "monto", valor: 50000 });
  assert.equal(c.descuento(), 10000);
  assert.equal(c.total(), 0);
});

test("rechaza tipo de cupón inválido o valor no positivo", () => {
  const c = new Carrito();
  assert.throws(() => c.aplicarCupon({ tipo: "regalo", valor: 5 }), TypeError);
  assert.throws(() => c.aplicarCupon({ tipo: "monto", valor: 0 }), RangeError);
  assert.throws(() => c.aplicarCupon({ tipo: "monto", valor: -5 }), RangeError);
});

test("regresión: un cupón en forma de cadena ya no se ejecuta", () => {
  const c = new Carrito();
  c.agregar("Aceite", 100000);
  assert.throws(() => c.aplicarCupon("total * 0.9"), TypeError);
  assert.throws(() => c.aplicarCupon("process.exit(1)"), TypeError);
  assert.equal(c.total(), 100000);
});

test("quitarCupon restaura el total", () => {
  const c = new Carrito();
  c.agregar("Aceite", 100000);
  c.aplicarCupon({ tipo: "porcentaje", valor: 50 });
  c.quitarCupon();
  assert.equal(c.total(), 100000);
});

// --- Redondeo y encapsulamiento --------------------------------------------

test("0.1 + 0.2 da 0.3 (sin error de punto flotante)", () => {
  const c = new Carrito();
  c.agregar("A", 0.1);
  c.agregar("B", 0.2);
  assert.equal(c.total(), 0.3);
});

test("items devuelve una copia y no permite modificar el carrito", () => {
  const c = new Carrito();
  c.agregar("Aceite", 25000);
  c.items[0].cantidad = 999;
  assert.equal(c.items[0].cantidad, 1);
});
