import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const DIAS = 24 * 60 * 60 * 1000;
const hace = (dias) => new Date(Date.now() - dias * DIAS);

async function asegurarIglesia(nombre, direccion, telefono) {
  let ig = await db.iglesia.findFirst({ where: { nombre } });
  if (!ig) {
    ig = await db.iglesia.create({ data: { nombre, direccion, telefono } });
  }
  for (const estado of [
    "DESEA_SER_CONTACTADO",
    "PRIMER_CONTACTO",
    "SEGUNDO_CONTACTO",
    "VISITA_AMISTAD",
  ]) {
    await db.alertaConfig.upsert({
      where: { iglesiaId_estado: { iglesiaId: ig.id, estado } },
      update: {},
      create: { iglesiaId: ig.id, estado, maxHoras: 100 },
    });
  }
  return ig;
}

async function asegurarUsuario(
  hash,
  { usuario, nombre, apellido, telefono, rol, iglesiaIds, redId, grupoId }
) {
  let u = await db.usuario.findUnique({ where: { usuario } });
  if (!u) {
    u = await db.usuario.create({
      data: {
        usuario,
        passwordHash: hash,
        nombre,
        apellido,
        telefono,
        rol,
        redId: redId ?? null,
        grupoId: grupoId ?? null,
        iglesias: { create: iglesiaIds.map((iglesiaId) => ({ iglesiaId })) },
      },
    });
  }
  return u;
}

async function asegurarOrigen(nombre) {
  let o = await db.origen.findFirst({ where: { nombre, iglesiaId: null } });
  if (!o) o = await db.origen.create({ data: { nombre, iglesiaId: null } });
  return o;
}

async function asegurarVisitante(d, historial) {
  let v = await db.visitante.findFirst({
    where: { nombre: d.nombre, apellido: d.apellido },
  });
  if (v) return v;
  v = await db.visitante.create({ data: d });
  for (const h of historial) {
    await db.visitanteHistorial.create({
      data: {
        visitanteId: v.id,
        deEstado: h.de ?? null,
        aEstado: h.a,
        fechaCambio: h.cambio,
        fechaContacto: h.contacto ?? null,
        cambiadoPorId: h.por ?? null,
        observaciones: h.obs ?? null,
      },
    });
  }
  return v;
}

async function main() {
  // Superadmin
  const saUser = process.env.SEED_SUPERADMIN ?? "SuperAdmin";
  const saPass = process.env.SEED_PASSWORD ?? "Admin1234";
  if (!(await db.usuario.findUnique({ where: { usuario: saUser } }))) {
    await db.usuario.create({
      data: {
        usuario: saUser,
        passwordHash: await bcrypt.hash(saPass, 10),
        nombre: "Super",
        apellido: "Admin",
        rol: "SUPERADMIN",
      },
    });
    console.log(`Superadmin creado: ${saUser}`);
  }

  for (const n of [
    "Operación Mateo 25",
    "Evangelismo",
    "1ra visita iglesia",
    "1ra visita grupo",
  ]) {
    await asegurarOrigen(n);
  }
  const origen = {};
  for (const o of await db.origen.findMany({ where: { iglesiaId: null } })) {
    origen[o.nombre] = o.id;
  }

  // Iglesias ficticias
  const central = await asegurarIglesia(
    "I. Cuadrangular Central",
    "Av. Principal 123",
    "600111222"
  );
  const norte = await asegurarIglesia(
    "I. Cuadrangular Norte",
    "Calle Norte 456",
    "600333444"
  );
  await asegurarIglesia("I. Cuadrangular Sur", "Av. Sur 789", "600555666");
  await asegurarIglesia("I. Cuadrangular Este", "Jr. Este 321", "600777888");

  // Redes y grupos (Central)
  let fam = await db.red.findFirst({
    where: { nombre: "Red Familias", iglesiaId: central.id },
  });
  if (!fam) {
    fam = await db.red.create({
      data: { nombre: "Red Familias", iglesiaId: central.id },
    });
  }
  let jov = await db.red.findFirst({
    where: { nombre: "Red Jóvenes", iglesiaId: central.id },
  });
  if (!jov) {
    jov = await db.red.create({
      data: { nombre: "Red Jóvenes", iglesiaId: central.id },
    });
  }
  async function grupo(nombre, redId) {
    let g = await db.grupo.findFirst({ where: { nombre, redId } });
    if (!g) {
      g = await db.grupo.create({
        data: { nombre, redId, iglesiaId: central.id },
      });
    }
    return g;
  }
  const gracia = await grupo("Grupo Gracia - 101", fam.id);
  const fe = await grupo("Grupo Fe - 102", fam.id);
  const fuego = await grupo("Grupo Jóvenes Fuego", jov.id);

  // Personas ficticias (clave común solo para pruebas locales)
  const hash = await bcrypt.hash("Visita123", 10);
  const pastor = await asegurarUsuario(hash, {
    usuario: "pastor.juan",
    nombre: "Juan",
    apellido: "Ríos",
    telefono: "611222333",
    rol: "PASTOR",
    iglesiaIds: [central.id, norte.id],
  });
  await asegurarUsuario(hash, {
    usuario: "lider.maria",
    nombre: "María",
    apellido: "López",
    telefono: "622333444",
    rol: "LIDER_CONSOLIDADOR",
    iglesiaIds: [central.id],
  });
  const lidRed = await asegurarUsuario(hash, {
    usuario: "lider.familias",
    nombre: "Pedro",
    apellido: "Salazar",
    rol: "LIDER_RED",
    iglesiaIds: [central.id],
    redId: fam.id,
  });
  await db.red.update({
    where: { id: fam.id },
    data: { liderId: lidRed.id },
  });
  const lidGrupo = await asegurarUsuario(hash, {
    usuario: "lider.gracia",
    nombre: "Ana",
    apellido: "Torres",
    rol: "LIDER_GRUPO",
    iglesiaIds: [central.id],
    grupoId: gracia.id,
  });
  await db.grupo.update({
    where: { id: gracia.id },
    data: { liderId: lidGrupo.id },
  });
  const diego = await asegurarUsuario(hash, {
    usuario: "conso.diego",
    nombre: "Diego",
    apellido: "Paredes",
    telefono: "633444555",
    rol: "CONSOLIDADOR",
    iglesiaIds: [central.id],
    grupoId: gracia.id,
  });
  const luz = await asegurarUsuario(hash, {
    usuario: "conso.luz",
    nombre: "Luz",
    apellido: "Herrera",
    telefono: "644555666",
    rol: "CONSOLIDADOR",
    iglesiaIds: [central.id],
    grupoId: fuego.id,
  });

  // Visitantes ficticios
  const V = (o) => ({
    iglesiaId: central.id,
    ...o,
  });
  await asegurarVisitante(
    V({
      nombre: "Pedro",
      apellido: "Sánchez",
      zona: "Centro",
      telefono: "699888777",
      invitadoPor: "Campaña en la plaza",
      origenId: origen["Evangelismo"],
      redId: fam.id,
      grupoId: gracia.id,
      consolidadorId: diego.id,
      estadoActual: "DESEA_SER_CONTACTADO",
      createdAt: hace(2),
      updatedAt: hace(2),
    }),
    [{ a: "DESEA_SER_CONTACTADO", cambio: hace(2), por: pastor.id }]
  );
  await asegurarVisitante(
    V({
      nombre: "Lucía",
      apellido: "Fernández",
      zona: "Norte",
      telefono: "687654321",
      origenId: origen["1ra visita iglesia"],
      redId: fam.id,
      grupoId: gracia.id,
      consolidadorId: diego.id,
      estadoActual: "PRIMER_CONTACTO",
      peticiones: "Por su familia y su trabajo",
      createdAt: hace(9),
      updatedAt: hace(8),
    }),
    [
      { a: "DESEA_SER_CONTACTADO", cambio: hace(9), por: pastor.id },
      {
        a: "PRIMER_CONTACTO",
        cambio: hace(8),
        contacto: hace(8),
        por: diego.id,
        obs: "Llamada de presentación",
      },
    ]
  );
  await asegurarVisitante(
    V({
      nombre: "Carlos",
      apellido: "Gómez",
      zona: "Gracia",
      telefono: "636333444",
      origenId: origen["Operación Mateo 25"],
      redId: fam.id,
      grupoId: fe.id,
      consolidadorId: diego.id,
      estadoActual: "SEGUNDO_CONTACTO",
      createdAt: hace(15),
      updatedAt: hace(6),
    }),
    [
      { a: "DESEA_SER_CONTACTADO", cambio: hace(15), por: pastor.id },
      {
        a: "PRIMER_CONTACTO",
        cambio: hace(13),
        contacto: hace(13),
        por: diego.id,
      },
      {
        a: "SEGUNDO_CONTACTO",
        cambio: hace(6),
        contacto: hace(6),
        por: diego.id,
        obs: "Aceptó segunda llamada",
      },
    ]
  );
  await asegurarVisitante(
    V({
      nombre: "Ana",
      apellido: "Pérez",
      zona: "Sants",
      telefono: "635555666",
      origenId: origen["1ra visita grupo"],
      redId: jov.id,
      grupoId: fuego.id,
      consolidadorId: luz.id,
      estadoActual: "VISITA_AMISTAD",
      peticiones: "Salud de su madre",
      createdAt: hace(30),
      updatedAt: hace(2),
    }),
    [
      { a: "DESEA_SER_CONTACTADO", cambio: hace(30), por: pastor.id },
      {
        a: "PRIMER_CONTACTO",
        cambio: hace(28),
        contacto: hace(28),
        por: luz.id,
      },
      {
        a: "SEGUNDO_CONTACTO",
        cambio: hace(21),
        contacto: hace(21),
        por: luz.id,
      },
      {
        de: "SEGUNDO_CONTACTO",
        a: "VISITA_AMISTAD",
        cambio: hace(7),
        contacto: hace(7),
        por: luz.id,
        obs: "Primera visita de amistad",
      },
      {
        de: "VISITA_AMISTAD",
        a: "VISITA_AMISTAD",
        cambio: hace(2),
        contacto: hace(2),
        por: luz.id,
        obs: "Segunda visita de amistad",
      },
    ]
  );
  await asegurarVisitante(
    {
      iglesiaId: norte.id,
      nombre: "Marta",
      apellido: "Ruiz",
      zona: "Norte",
      telefono: "637777888",
      origenId: origen["Evangelismo"],
      estadoActual: "DESEA_SER_CONTACTADO",
      createdAt: hace(4),
      updatedAt: hace(4),
    },
    [{ a: "DESEA_SER_CONTACTADO", cambio: hace(4), por: pastor.id }]
  );
  await asegurarVisitante(
    V({
      nombre: "Laura",
      apellido: "Martínez",
      zona: "Centro",
      telefono: "631111222",
      origenId: origen["Evangelismo"],
      redId: fam.id,
      grupoId: gracia.id,
      consolidadorId: diego.id,
      estadoActual: "SEGUNDO_CONTACTO",
      createdAt: hace(12),
      updatedAt: hace(3),
    }),
    [
      { a: "DESEA_SER_CONTACTADO", cambio: hace(12), por: pastor.id },
      {
        a: "PRIMER_CONTACTO",
        cambio: hace(10),
        contacto: hace(10),
        por: diego.id,
      },
      {
        a: "SEGUNDO_CONTACTO",
        cambio: hace(3),
        contacto: hace(3),
        por: diego.id,
      },
    ]
  );

  console.log("Datos ficticios listos");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
