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
