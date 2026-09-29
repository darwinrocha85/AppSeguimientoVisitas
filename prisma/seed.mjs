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
  let previo = null;
  for (const h of historial) {
    const de = h.de ?? previo;
    await db.visitanteHistorial.create({
      data: {
        visitanteId: v.id,
        deEstado: de,
        aEstado: h.a,
        fechaCambio: h.cambio,
        fechaContacto: h.contacto ?? null,
        cambiadoPorId: h.por ?? null,
        observaciones: h.obs ?? null,
      },
    });
    previo = h.a;
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
  const sur = await db.iglesia.findFirst({ where: { nombre: "I. Cuadrangular Sur" } });
  const este = await db.iglesia.findFirst({ where: { nombre: "I. Cuadrangular Este" } });

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
  async function grupo(nombre, redId, iglesia) {
    let g = await db.grupo.findFirst({ where: { nombre, redId } });
    if (!g) {
      g = await db.grupo.create({
        data: { nombre, redId, iglesiaId: iglesia.id },
      });
    }
    return g;
  }
  const gracia = await grupo("Grupo Gracia - 101", fam.id, central);
  const fe = await grupo("Grupo Fe - 102", fam.id, central);
  const fuego = await grupo("Grupo Jóvenes Fuego", jov.id, central);

  async function red(nombre, iglesia) {
    let r = await db.red.findFirst({ where: { nombre, iglesiaId: iglesia.id } });
    if (!r) {
      r = await db.red.create({ data: { nombre, iglesiaId: iglesia.id } });
    }
    return r;
  }
  const redNorte = await red("Red Norte", norte);
  const redSur = await red("Red Sur", sur);
  const redEste = await red("Red Este", este);
  const gNorte = await grupo("Grupo Norte - 201", redNorte.id, norte);
  const gSur = await grupo("Grupo Sur - 301", redSur.id, sur);
  const gEste = await grupo("Grupo Este - 401", redEste.id, este);

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
    iglesiaIds: [central.id, norte.id],
  });
  const pastorLuis = await asegurarUsuario(hash, {
    usuario: "pastor.luis",
    nombre: "Luis",
    apellido: "Fernando",
    telefono: "612333444",
    rol: "PASTOR",
    iglesiaIds: [sur.id, este.id],
  });
  await asegurarUsuario(hash, {
    usuario: "lider.jose",
    nombre: "José",
    apellido: "Martín",
    telefono: "623444555",
    rol: "LIDER_CONSOLIDADOR",
    iglesiaIds: [sur.id, este.id],
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
  const pablo = await asegurarUsuario(hash, {
    usuario: "conso.pablo",
    nombre: "Pablo",
    apellido: "Núñez",
    telefono: "655666777",
    rol: "CONSOLIDADOR",
    iglesiaIds: [central.id],
    grupoId: fe.id,
  });
  const sara = await asegurarUsuario(hash, {
    usuario: "conso.sara",
    nombre: "Sara",
    apellido: "Vidal",
    telefono: "666777888",
    rol: "CONSOLIDADOR",
    iglesiaIds: [central.id],
    grupoId: fuego.id,
  });
  const elena = await asegurarUsuario(hash, {
    usuario: "conso.elena",
    nombre: "Elena",
    apellido: "Soto",
    telefono: "677888999",
    rol: "CONSOLIDADOR",
    iglesiaIds: [norte.id],
    grupoId: gNorte.id,
  });
  const marco = await asegurarUsuario(hash, {
    usuario: "conso.marco",
    nombre: "Marco",
    apellido: "Reyes",
    telefono: "688999000",
    rol: "CONSOLIDADOR",
    iglesiaIds: [sur.id],
    grupoId: gSur.id,
  });
  const este1 = await asegurarUsuario(hash, {
    usuario: "conso.este1",
    nombre: "Ruth",
    apellido: "Cordero",
    telefono: "699000111",
    rol: "CONSOLIDADOR",
    iglesiaIds: [este.id],
    grupoId: gEste.id,
  });
  const este2 = await asegurarUsuario(hash, {
    usuario: "conso.este2",
    nombre: "Samuel",
    apellido: "Ortiz",
    telefono: "699000222",
    rol: "CONSOLIDADOR",
    iglesiaIds: [este.id],
    grupoId: gEste.id,
  });

  // Líderes de red y grupo restantes (uno por nivel para la demo)
  async function liderRed(usuario, nombre, apellido, iglesia, redObj) {
    const u = await asegurarUsuario(hash, {
      usuario,
      nombre,
      apellido,
      rol: "LIDER_RED",
      iglesiaIds: [iglesia.id],
      redId: redObj.id,
    });
    await db.red.update({ where: { id: redObj.id }, data: { liderId: u.id } });
    return u;
  }
  async function liderGrupo(usuario, nombre, apellido, iglesia, grupoObj) {
    const u = await asegurarUsuario(hash, {
      usuario,
      nombre,
      apellido,
      rol: "LIDER_GRUPO",
      iglesiaIds: [iglesia.id],
      grupoId: grupoObj.id,
    });
    await db.grupo.update({
      where: { id: grupoObj.id },
      data: { liderId: u.id },
    });
    return u;
  }
  await liderRed("lider.jovenes", "Carmen", "Díaz", central, jov);
  await liderRed("lider.norte", "Hugo", "Molina", norte, redNorte);
  await liderRed("lider.sur", "Irene", "Vargas", sur, redSur);
  await liderRed("lider.redeste", "Tomás", "Ramos", este, redEste);
  await liderGrupo("lider.fe", "Paula", "Serra", central, fe);
  await liderGrupo("lider.fuego", "Andrés", "Blanco", central, fuego);
  await liderGrupo("lider.norte201", "Mario", "Suárez", norte, gNorte);
  await liderGrupo("lider.sur301", "Julia", "Aguilar", sur, gSur);
  await liderGrupo("lider.este401", "David", "Delgado", este, gEste);

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

  // --- Generador masivo determinista: ~200 visitantes, 90 días de historia ---
  // Vertical = nº de visitantes, horizontal = fechas. Permite ver todas las
  // opciones (estados, redes, grupos, consolidadores, rangos con movimiento).
  const cuantos = await db.visitante.count();
  if (cuantos < 200) {
    let sem = 987654321;
    const rnd = () => (sem = (sem * 1103515245 + 12345) % 2147483648) / 2147483648;
    const ent = (n) => Math.floor(rnd() * n);
    const NOMBRES = ["Pedro", "Lucía", "Carlos", "Ana", "Marta", "Laura", "Diego", "Carmen", "José", "María", "Juan", "Elena", "Pablo", "Sara", "Marco", "Luz", "Raúl", "Nadia", "Hugo", "Irene", "Tomás", "Paula", "Andrés", "Sofía", "Mario", "Julia", "David", "Clara", "Iván", "Rosa"];
    const APELLIDOS = ["Sánchez", "Fernández", "Gómez", "Pérez", "Ruiz", "Martínez", "Torres", "López", "Ríos", "Díaz", "Moreno", "Álvarez", "Romero", "Navarro", "Serra", "Vidal", "Soto", "Reyes", "Cruz", "Ortega", "Molina", "Vargas", "Castillo", "Ramos", "Blanco", "Suárez", "Herrera", "Aguilar", "Delgado", "Marín"];
    const ZONAS = ["Centro", "Norte", "Sur", "Este", "Gracia", "Sants", "Barrio Alto", "La Plaza"];
    const INVITAN = ["Campaña en la plaza", "Un amigo", "Folleto", "Redes sociales", null, null];
    const ORIGENES = Object.values(origen);
    const CADENA = ["DESEA_SER_CONTACTADO", "PRIMER_CONTACTO", "SEGUNDO_CONTACTO", "VISITA_AMISTAD"];
    const RASOS = { [gracia.id]: [diego, pablo], [fe.id]: [pablo], [fuego.id]: [luz, sara], [gNorte.id]: [elena], [gSur.id]: [marco], [gEste.id]: [este1, este2] };

    let creados = 0;
    for (let i = 0; cuantos + creados < 200; i++) {
      // Iglesia ponderada (todas con visitantes en todos los estados)
      const rI = rnd();
      const ig = rI < 0.5 ? central : rI < 0.7 ? norte : rI < 0.85 ? sur : este;
      let redId = null;
      let grupoId = null;
      let conso = null;
      if (ig.id === central.id) {
        if (rnd() < 0.65) {
          redId = fam.id;
          grupoId = rnd() < 0.6 ? gracia.id : fe.id;
        } else {
          redId = jov.id;
          grupoId = fuego.id;
        }
      } else if (ig.id === norte.id) {
        redId = redNorte.id;
        grupoId = gNorte.id;
      } else if (ig.id === sur.id) {
        redId = redSur.id;
        grupoId = gSur.id;
      } else {
        redId = redEste.id;
        grupoId = gEste.id;
      }
      if (grupoId && RASOS[grupoId]) {
        const lista = RASOS[grupoId];
        conso = lista[ent(lista.length)];
      }
      // Longitud de cadena: 1 (30%), 2 (25%), 3 (25%), 4+ (20%)
      const rC = rnd();
      const pasos = rC < 0.3 ? 1 : rC < 0.55 ? 2 : rC < 0.8 ? 3 : 4;
      const finalHace = ent(60); // último cambio: hoy..hace 60 días
      // Caminar hacia atrás para fechar la creación
      let haceDias = finalHace;
      const fechas = [haceDias];
      for (let p = 1; p < pasos; p++) {
        haceDias += 1 + ent(7);
        fechas.unshift(haceDias);
      }
      if (fechas[0] > 90) continue; // fuera de ventana, reintentar
      const nombre = NOMBRES[(i * 7 + 3) % NOMBRES.length];
      const apellido = APELLIDOS[(i * 11 + 5) % APELLIDOS.length];
      const creado = await db.visitante.create({
        data: {
          nombre,
          apellido,
          zona: ZONAS[ent(ZONAS.length)],
          telefono: `6${String(10000000 + ((i * 7919) % 89999999)).padStart(8, "0")}`,
          invitadoPor: INVITAN[ent(INVITAN.length)],
          peticiones: rnd() < 0.3 ? "Petición de oración de prueba" : null,
          origenId: ORIGENES[ent(ORIGENES.length)],
          iglesiaId: ig.id,
          redId,
          grupoId,
          consolidadorId: conso ? conso.id : null,
          estadoActual: CADENA[pasos - 1],
          createdAt: hace(fechas[0]),
          updatedAt: hace(fechas[fechas.length - 1]),
        },
      });
      creados++;
      let previo = null;
      for (let p = 0; p < pasos; p++) {
        const creador =
          ig.id === sur.id || ig.id === este.id ? pastorLuis.id : pastor.id;
        const quien = p === 0 ? creador : conso ? conso.id : creador;
        await db.visitanteHistorial.create({
          data: {
            visitanteId: creado.id,
            deEstado: previo,
            aEstado: CADENA[p],
            fechaCambio: hace(fechas[p]),
            fechaContacto: p === 0 ? null : hace(fechas[p]),
            cambiadoPorId: quien,
          },
        });
        previo = CADENA[p];
      }
      // 30% de los consolidados: visita de amistad extra
      if (pasos === 4 && rnd() < 0.3 && fechas[fechas.length - 1] > 2) {
        await db.visitanteHistorial.create({
          data: {
            visitanteId: creado.id,
            deEstado: "VISITA_AMISTAD",
            aEstado: "VISITA_AMISTAD",
            fechaCambio: hace(Math.max(0, fechas[fechas.length - 1] - (1 + ent(5)))),
            fechaContacto: hace(Math.max(0, fechas[fechas.length - 1] - (1 + ent(5)))),
            cambiadoPorId: conso ? conso.id : pastor.id,
          },
        });
      }
    }
    console.log(`Generados ${creados} visitantes (total ${cuantos + creados})`);
  }

  console.log("Datos ficticios listos");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
