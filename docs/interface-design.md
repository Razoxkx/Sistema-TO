# Diseño de Espacio TO

## Alcance y decisiones

Remodelación de login, sidebar, Inicio, tarjetas de usuarios y fichas clínicas. La paleta existente se conserva. El usuario pidió utilizar únicamente UI UX Pro Max; frontend-design no se aplica a este trabajo.

La búsqueda local de UI UX Pro Max devuelve criterios de interfaces profesionales, etiquetas explícitas, campos controlados y feedback al guardar. El generador propone también patrones de landing y otra paleta: esas partes no corresponden a este producto ni a las restricciones del usuario y no se incorporan.

## Sistema visual

Se reutilizan los colores presentes: verde #376b53, verde oscuro #355c46, salvia #eaf2ec, superficie #ffffff, fondo #fafcfb, tinta #20313a y pizarra #626f77. Los tonos auxiliares se toman de la paleta existente.

Tipografía de sistema, con títulos de 28–36 px, texto de 14–15 px y etiquetas de 12 px. Radios diferenciados: 8–10 px en controles, 14 px en tarjetas y 20 px en el panel de bienvenida.

Los campos tienen una etiqueta interior permanente y una superficie sutil, con foco en verde y errores textuales asociados. La edad muestra la unidad años. Las secciones se presentan en filas completas, con títulos alineados a la izquierda en pantallas amplias. Las observaciones crecen automáticamente al escribir y al cargar una ficha existente, sin tiradores de redimensionado ni barras internas. Se conserva la edición de textos largos y el formulario compacto en columnas adaptables.

## Verificación

Comprobar login, sidebar abierto/cerrado, tarjetas, consulta/edición de fichas y diálogo de cambios sin guardar. Revisar 320, 375, 768, 1024 y 1440 px. Conservar la navegación por teclado, labels asociados, contraste, estados de error y respeto a movimiento reducido. No cambiar la lógica de acceso ni el aislamiento de las fichas.

## Consulta de ficha y sesiones

La tarjeta abre un `dialog` modal sobre el listado de usuarios, con fondo difuminado de 6px. El encabezado conserva el nombre, cierre y acciones visibles; el contenido se desplaza dentro del modal. El fondo queda inerte y sin desplazamiento. Escape, cierre y clic exterior vuelven al listado; los cambios pendientes requieren confirmación. El foco vuelve a la tarjeta al cerrar.

Las vistas «Ficha clínica» y «Sesiones» separan antecedentes e historial. «Nueva sesión» utiliza el mismo modal con fecha y notas de actividades, objetivos, observaciones y próximos pasos. Tras guardar, muestra el historial y confirma el resultado. En móviles, el modal conserva márgenes y un único desplazamiento vertical. Se mantienen los tokens de color y los controles de notas sin marcas de redimensionado.

## Valor y edición de sesiones

Fecha y valor (CLP, pesos enteros) se agrupan en la primera fila del formulario y se apilan en móvil. El historial muestra el importe con formato chileno y un botón «Editar sesión» por atención. Las sesiones anteriores sin importe mantienen «Valor sin registrar» hasta completarlo. Crear o editar permite fechas anteriores; guardar una edición actualiza el registro existente, sus notas, fecha y valor. Se conservan las confirmaciones de cambios pendientes y el modal con fondo difuminado.

## Finanzas

La vista reutiliza la paleta clínica y la tipografía existentes. El resumen prioriza el ingreso mensual; sesiones y usuarios aportan contexto. Un selector de período, navegación entre meses y la acción «Mes actual» permiten consultar el historial. La tabla por usuario se adapta a filas compactas en móvil y enlaza a cada ficha. El historial muestra doce botones de mes con importes explícitos, sin depender del color para identificar la selección. Se señalan las sesiones sin valor, con estados de carga, error, reintento y mes vacío.

UI UX Pro Max devolvió patrones de landing y modo oscuro que no corresponden a esta vista; se descartaron por la paleta acordada. La búsqueda específica sobre tablas aporta la pauta aplicable de adaptar el detalle para evitar desbordamientos en móvil.

## Informes

Una tercera vista dentro de la ficha reúne los informes. La creación separa selección, revisión de sesiones y autorización de envío. Los estados de carga y error se muestran en el mismo formulario; un fallo del proveedor no produce un informe ficticio. El borrador se guarda antes de ofrecer revisión y descarga. La edición conserva notas y referencias, confirma cambios pendientes y permite marcar la revisión del terapeuta. El PDF usa la paleta clínica, tipografía Unicode, márgenes consistentes y pies numerados; se verificó con documentos cortos y de varias páginas.

## Calendario y planificaciones

El calendario mantiene la paleta clínica y presenta mes, día seleccionado y agenda. La navegación de meses y el selector nativo complementan los días como botones accesibles. En móvil, la agenda aparece bajo el mes. La creación y edición de horarios utiliza un modal con búsqueda paginada de usuarios existentes.

En cada ficha, Planificaciones utiliza las superficies de formulario existentes y notas de altura automática, con objetivos como tareas marcables. Antes de guardar aparece un modal de asignación con sesiones exclusivas del usuario. La confirmación muestra el nombre, fecha y hora de la sesión. Los diálogos anidados comparten un bloqueo de desplazamiento para restaurar el fondo correctamente al cerrar o descartar cambios. Los patrones de landing que devolvió la búsqueda de diseño no se incorporaron; se conservó el sistema visual acordado.

## Ingreso y registro local

El panel de bienvenida y la paleta se conservan. El acceso con correo y contraseña aparece primero cuando está habilitado, con una acción para crear cuenta. El registro añade nombre y confirmación de contraseña; todas las etiquetas permanecen visibles, los campos reutilizan las superficies clínicas y las contraseñas tienen controles para mostrar u ocultar. Los errores se presentan junto al formulario y los envíos bloquean sus controles mientras se procesan.

Google se ofrece como alternativa solamente en orígenes compatibles. En la dirección HTTP de la red local se muestra el acceso local, sin cargar el SDK de Google. El registro recuerda que una cuenta Google existente debe activar la contraseña en Mi cuenta para conservar sus fichas. Esa vista añade estado del acceso, identidad, confirmación de contraseña y protección ante cambios sin guardar. En móvil los campos tienen texto de 16 px, controles de visibilidad de 44 px y una sola columna sin desbordamiento horizontal.

## Apariencia clara y oscura

El selector de apariencia está disponible en el inicio de sesión y en el encabezado del espacio de trabajo. Ofrece Claro, Oscuro y Sistema; por defecto sigue el sistema. La preferencia se guarda por navegador y origen, se sincroniza entre pestañas del mismo origen y se aplica antes de dibujar la página. Sistema responde también a cambios del dispositivo. Si el almacenamiento está bloqueado, la elección sigue funcionando durante la visita.

El tema oscuro utiliza fondos verde bosque, superficies elevadas y acentos salvia de la misma familia clínica. Texto, etiquetas, bordes de controles, errores, confirmaciones, ilustración y superposiciones usan variables semánticas. Los botones principales tienen un color de texto propio para conservar contraste sobre el acento claro. Los controles nativos de fecha, hora y mes reciben `color-scheme`; el botón Google usa sus [variantes oficiales](https://developers.google.com/identity/gsi/web/reference/js-reference#theme) según el tema. El PDF conserva su presentación clínica para impresión.

En smartphone el selector ocupa un control de 44 × 44 px con nombre accesible y opciones nativas; no desplaza el menú ni las migas de navegación. Los campos de búsqueda usan 16 px para evitar el zoom al enfocar en iPhone. Cambiar de tema conserva los formularios abiertos y sus cambios pendientes.

## Estabilidad al navegar

La ficha conserva una altura estable entre Ficha clínica, Sesiones, Informes y Planificaciones; solo se desplaza su contenido. Los formularios secundarios de agenda y asignación mantienen su tamaño compacto. Se reserva el espacio de las barras de desplazamiento para evitar movimientos horizontales.

Las listas de usuarios, sesiones, informes, planificaciones, calendario y finanzas conservan su última respuesta en memoria durante la visita del terapeuta. Al volver se muestran inmediatamente y se consultan de nuevo en segundo plano. La memoria se separa por servicio y consulta, con un máximo de treinta consultas por servicio; se descarta al cerrar sesión o cambiar de terapeuta y se limpia ante un error de autenticación. No se escribe información clínica en almacenamiento persistente del navegador. Las respuestas de consultas canceladas no reemplazan la vista actual.

Finanzas agrupa los eventos de foco y visibilidad de un mismo regreso al navegador. Un período nuevo muestra la estructura de resumen e historial durante la carga, sin atribuir valores del mes anterior al mes seleccionado. El calendario conserva la cuadrícula durante la consulta. El logotipo navega dentro de la aplicación y respeta el aviso de cambios pendientes.

Verificación con respuestas sintéticas de 1,6 segundos: regreso a Finanzas sin ocultar sus importes, cambio rápido de meses, pestañas de la ficha sin redimensionado, conservación del último resultado ante un error de red y limpieza al recibir 401. El modal mantiene 656 px de altura y 32 px de margen superior en 1280 × 720, y 820 px con 12 px de margen en 390 × 844, sin desbordamiento horizontal.

## Acceso directo en la pantalla de inicio

El arranque identifica `display-mode: standalone` y el indicador de iOS `navigator.standalone`, sin usar el modelo del dispositivo. Esta modalidad se diferencia de abrir la web en Safari. La instalación declara nombre, ámbito, URL inicial e iconos en `site.webmanifest`; no añade funcionamiento sin conexión ni almacenamiento de fichas.

En modo app, el desenfoque se aplica a la superficie estática del espacio de trabajo. Los diálogos se renderizan mediante portales bajo `body`, fuera de esa superficie, y su `::backdrop` conserva únicamente el oscurecimiento. Así los cambios de contenido de la ficha no requieren recalcular el filtro del fondo del diálogo. En navegador normal se conserva el desenfoque de `::backdrop`. El bloqueo de fondo es compartido por modales y menú móvil, admite anidamiento y restaura los estilos y el desplazamiento al cerrar el último diálogo.

En teléfono y modo app, la ficha se ancla a los márgenes superiores y usa la altura estable `svh`; [WebKit distingue esta unidad de la altura dinámica `dvh`](https://webkit.org/blog/12445/new-webkit-features-in-safari-15-4/). Los cambios de pestaña desplazan solo el contenido de la ficha antes del repintado, y el enfoque programático solicita `preventScroll`. La navegación instalada usa History API y conserva los eventos de retroceso. El HTML se revalida para recibir nuevas compilaciones.

Verificación con datos sintéticos y modalidad app simulada: modal fuera del fondo filtrado, desenfoque de 6 px solo en el fondo, bloqueo de página conservado al cerrar un modal secundario, restauración del fondo tras descartar cambios, retroceso entre pestañas y anchura de 390 px sin desbordamiento. Después de publicar y recrear el acceso directo, el usuario confirmó que las pestañas de la ficha funcionan sin parpadeo en su iPhone 13.

## Icono de Espacio TO

El logotipo proporcionado se exporta con transparencia exterior, manteniendo el texto blanco interior. Se utiliza en la marca de la interfaz, favicon PNG de 32 px, icono Apple de 180 px e iconos de manifiesto de 192 y 512 px. La fuente transparente queda en `public/icons/espacio-to-master.png`. El icono ya añadido a la pantalla de inicio puede requerir recrear el acceso directo para actualizar sus metadatos.
