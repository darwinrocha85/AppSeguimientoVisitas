# Instrucciones para agentes

## Producto

- La aplicación da seguimiento a las personas que visitan una iglesia por primera vez.
- Debe funcionar como sitio web y poder instalarse en celulares compatibles como PWA. No describas una PWA como una app nativa publicada en una tienda.
- Todos los usuarios del sistema inician sesión. Los visitantes son registros de seguimiento, no cuentas de acceso.
- Mantén la interfaz en español salvo que el proyecto indique lo contrario.

## Modelo de organizaciones

- La jerarquía es Iglesia > Red > Grupo de conexión.
- Cada iglesia tiene al menos una red y cada red tiene al menos un grupo de conexión.
- Una iglesia está dirigida por un pastor y puede tener un líder consolidador de iglesia.
- Cada red tiene un líder de red; cada grupo de conexión tiene un líder de grupo.
- Un consolidador pertenece a un grupo de conexión y se le asignan visitantes.
- Distingue al **líder consolidador** (administrador de usuarios de la iglesia) del **consolidador** (persona que atiende visitantes).

## Roles y permisos

- **Superadministrador:** acceso global a estadísticas, organizaciones y usuarios; puede crear, consultar, actualizar y eliminar organizaciones y usuarios.
- **Pastor:** control de su iglesia, incluidas sus estadísticas y sus usuarios; puede administrar los usuarios de esa iglesia.
- **Líder consolidador:** control de su iglesia, estadísticas y usuarios; puede administrar los usuarios excepto al pastor.
- **Líder de red:** consulta estadísticas y usuarios de su red, sin permisos para editar ni eliminar. Puede consultar los datos del pastor de su iglesia, pero no debe conocer si ese pastor pertenece a otras iglesias.
- **Líder de grupo de conexión:** consulta estadísticas y usuarios de su grupo, sin permisos para editar ni eliminar. Puede consultar los datos del pastor de su iglesia, lider de red, pero no debe conocer si ese pastor pertenece a otras iglesias.
- **Consolidador:** consulta sus propias estadísticas y puede actualizar únicamente los visitantes que tiene asignados, incluyendo su estado, peticiones de oración y observaciones. Puede consultar los datos del pastor de su iglesia, lider de red, lider de grupo de conexion pero no debe conocer si ese pastor pertenece a otras iglesias.
- Un líder de red también puede ser líder de grupo de conexión. Representa ambos permisos sin duplicar su cuenta.
- Un pastor puede pertenecer como máximo a dos iglesias. Un líder consolidador también puede pertenecer como máximo a dos iglesias. Un líder de red y un líder de grupo pertenecen cada uno a una sola iglesia.
- Aplica los permisos en el servidor y limita cada consulta por rol, iglesia y alcance organizativo. No confíes únicamente en ocultar acciones en la interfaz.
- No expongas a líderes de red o de grupo las afiliaciones del pastor a otras iglesias, ni indirectamente mediante listados, contadores o respuestas de API.

## Seguimiento de visitantes y estadísticas

- El flujo de seguimiento incluye estos estados: **desea ser contactado**, **primer contacto**, **segundo contacto** y **visita de amistad**. 
- Los datos mencionados para un visitante incluyen estado, peticiones de oración, quién lo invitó y observaciones. No añadas campos obligatorios sin una necesidad confirmada.
- Permite seleccionar el rango de fechas de las estadísticas. Por defecto, muestra el último mes.
- Para el rango seleccionado, muestra el total de visitantes y las cantidades en cada etapa de seguimiento.
- Las estadísticas se consultan en los alcances de iglesia, red, grupo de conexión y consolidador, respetando siempre los permisos del usuario.
- La iglesia puede consultar el total de su alcance, cada red y cada grupo en particular.
- No inventes si el rango de fechas usa la fecha de registro, la fecha de cambio de estado u otra fecha. Si esa decisión afecta el resultado, pide confirmación o documenta la suposición antes de implementarla.
- del visitante se sabe obligatorio: nombre, apellido, zona donde vive (text), opcional: edad, codigo postal y calle. 

## Plataforma y datos

- Objetivo de despliegue: Vercel, con experiencia web adaptable e instalable como PWA.
- Recomendación inicial para una aplicación nueva: Next.js con TypeScript y una base de datos PostgreSQL administrada compatible con Vercel.
- SQLite puede servir para desarrollo local, pero no guardes la base de datos de producción en el sistema de archivos efímero de Vercel. Si se mantiene SQLite, usa un servicio con almacenamiento persistente compatible y valida sus límites de concurrencia y despliegue antes de adoptarlo.
- Antes de añadir dependencias o fijar una arquitectura, revisa lo que ya existe en el repositorio. Si contradice esta recomendación, presenta las ventajas y limitaciones antes de reemplazarlo.

## Diseño y privacidad

- Usa las imágenes de referencia proporcionadas para las vistas de usuarios y consolidador cuando estén disponibles en el proyecto. No inventes detalles visuales que no aparezcan en ellas.
- Trata los datos personales y las peticiones de oración como información privada: muestra únicamente lo necesario para el rol y la tarea autorizados.
- No registres credenciales, tokens ni contenido sensible de visitantes en logs.

## Forma de trabajo

- Revisa la estructura, las instrucciones relacionadas y las convenciones existentes antes de cambiar código.
- Mantén los cambios enfocados en la solicitud y evita modificar trabajo previo no relacionado.
- Si falta una definición que pueda cambiar significativamente permisos, datos o estadísticas, pregunta antes de implementarla.
- Ejecuta las pruebas, análisis y compilaciones definidos por el proyecto después de los cambios pertinentes. En la respuesta final, resume los cambios y las validaciones realizadas, e indica lo que no se pudo comprobar.

### diseño
- en la  carpeta images_test hay tres imagen de diseños aprobados. 