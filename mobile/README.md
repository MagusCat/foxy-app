# Fox 🦊 — app Android

**Aplicación móvil para Android.** Teléfono en vertical, Cada decisión de
interfaz —el alto de los objetivos táctiles, las hojas que suben desde abajo,
el hueco que deja el teclado, la barra de pestañas flotante— está tomada para
una mano sobre un teléfono Android.

App de estudio para estudiantes de secundaria y universidad. Reúne en un solo
sitio las cuatro cosas que un estudiante hace a diario: preguntar dudas,
preparar exámenes, seguir sus clases y medir el tiempo que dedica a estudiar.

Expo SDK 54 · React Native 0.81 (nueva arquitectura) · expo-router ·
NativeWind 4 · TypeScript estricto.

## Plataforma

Android es el objetivo. El paquete es `com.anonymous.mobile`, la orientación
está fijada en vertical y `app.json` activa `edgeToEdgeEnabled`, así que la app
dibuja por debajo de la barra de estado y de la de navegación: los márgenes
seguros salen siempre de `useSafeAreaInsets`, nunca de valores a ojo.

Hay dos consecuencias de Android que conviene tener presentes al tocar código:

- **El teclado no reajusta la ventana.** Y el alto que informa el evento del
  teclado deja fuera la barra de navegación. Cualquier cosa anclada al borde
  inferior tiene que usar `useSheetPaddingBottom()`, que ya suma
  `insets.bottom`.
- **La galería devuelve nombres opacos** del estilo
  `79bac03b-5d84-4dae-b0a0-38f243297846.jpeg`, y deja los archivos en una caché
  que el sistema puede vaciar. De ahí `isOpaqueFileName` y `persistMedia`.

El código de iOS que hay (alturas táctiles algo mayores, `logo-apple` en el
inicio de sesión) está por si la app se publica también ahí, pero no es la
plataforma que se prueba. La build web existe únicamente como herramienta de
desarrollo para inspeccionar layout desde el escritorio; no es un destino.

## Empezar

```bash
npm install
```

```bash
npx expo start
```

Escanea el QR con Expo Go en el teléfono, o pulsa `a` para abrir un emulador
Android. Para compilar el paquete nativo:

```bash
npx expo start --android
```

Otros comandos:

| Comando | Para qué |
| --- | --- |
| `npx expo start --web` | Levanta la app en el navegador, solo para inspeccionar layout |
| `npx tsc --noEmit` | Comprueba tipos sin generar nada |
| `npx expo export --platform android` | Empaqueta todo el grafo; detecta imports rotos antes de probar en el teléfono |

### Probar en un teléfono conectado

Con el móvil en depuración USB, el ciclo corto es levantar Metro y abrirlo por
enlace profundo, sin tocar el QR:

```bash
adb shell am start -a android.intent.action.VIEW -d "exp://<IP-DEL-PC>:8081"
```

Para entrar directamente a una pantalla concreta se le añade la ruta:

```bash
adb shell am start -a android.intent.action.VIEW -d "exp://<IP-DEL-PC>:8081/--/exam/new"
```

Y para ver qué está pasando en pantalla:

```bash
adb exec-out screencap -p > captura.png
```

## Estructura

```
app/                      pantallas, enrutadas por archivo (expo-router)
  _layout.tsx             Stack raíz, proveedores y AuthGate
  (auth)/                 splash · onboarding · login · setup (primer inicio)
  (tabs)/                 Preguntar · Plan · Cuaderno · Perfil
  chat.tsx                conversaciones: lista por materia e hilo en una ruta
  exam/new.tsx            asistente de creación de preparación
  exam/[id].tsx           preparación: temas, progreso y archivos
  exam/topic.tsx          árbol de lecciones de un tema
  class/new.tsx           alta y edición de cuaderno (4 pasos)
  class/[id].tsx          cuaderno por dentro
  calendar.tsx            calendario propio con eventos y exámenes
  activity.tsx            racha, minutos e historial
  focus.tsx               temporizador de estudio
  history.tsx             preguntas guardadas
  achievements.tsx        logros
  subscription.tsx        planes de suscripción
  settings/               cuenta · aprendizaje · notificaciones · privacidad · ayuda · sobre Fox
components/               interfaz reutilizable
features/
  chat/components/        composer compartido (portada e hilo) y burbuja
  chat/hooks/             modelo de conversaciones agrupadas por materia
  chat/screens/           pantalla de chat (lista e hilo)
  shared/components/      portal (AppModal, SheetSlide) y overlay (hojas y diálogos)
  shared/hooks/           useGuardedRouter y useSubjectLimit
hooks/                    estado persistido y lógica de dominio
constants/                paleta, catálogos y tablas fijas
contexts/                 tema y sesión
lib/                      utilidades sin React
```

## Navegación

El Stack raíz vive en `app/_layout.tsx`. `AuthGate` mira la sesión del contexto
y redirige: sin sesión va a `(auth)/splash`, con sesión pero sin el primer
inicio completado va a `(auth)/setup`, y con todo listo a `(tabs)`. El splash
nativo se mantiene hasta que se resuelve esa decisión, para que no se vea un
parpadeo de pestañas.

Las transiciones por defecto son `slide_from_right` (260 ms). Las pestañas, el
chat y el arranque entran en fundido; los asistentes de examen y cuaderno y la
pantalla de planes suben desde abajo.

Todas las pantallas apiladas traen su propio encabezado, así que el del
navegador está oculto en el Stack (`headerShown: false`).

`FocusCompletionWatcher` también se monta en la raíz: es el único punto que
registra en la actividad las sesiones de enfoque que llegan a cero, para que se
apunten una sola vez por muchas pantallas que tengan el temporizador abierto.

## Las cuatro pestañas

### Preguntar (`app/(tabs)/index.tsx`) y chat (`app/chat.tsx`)

La portada saluda por nombre y muestra la meta del día, el próximo evento y el
panel de entrada (`ChatComposer`, compartido con el hilo): texto, cámara,
galería y archivos, con la materia y el modo de respuesta debajo del campo. Un
botón abre «¿Qué quieres hacer?» con atajos a escanear un problema, crear un
plan o ir al cuaderno. La portada nunca muestra un hilo: la conversación vive
en `/chat`.

Dentro de un tema la materia queda fija —la píldora lo señala con un candado—;
si se elige otra, se abre conversación nueva. En la lista, las conversaciones
se agrupan por materia. El menú «+» del composer lleva al modo enfoque y al
historial.

Enviar registra la pregunta en el historial y suma a la racha. El temporizador
de enfoque nunca arranca solo: el tiempo de estudio se registra desde el modo
enfoque.

### Plan (`app/(tabs)/exams.tsx`)

Lista los planes de estudio con su barra de dominio y la marca de la
calificación objetivo. Arriba van el buscador —que ignora tildes: «quim»
encuentra «Química»— y el botón de nuevo plan.

El asistente (`exam/new.tsx`) son cinco pasos —materia, fecha, calificación
objetivo, material, idioma— seguidos de una pantalla de preparación, una
encuesta breve y el plan generado. La calificación se elige con un dial
circular de 50 % a 100 %; la fecha con atajos (mañana, en 2 días, en 4 días),
una tira de próximos días o un calendario.

`exam/[id].tsx` es la preparación por dentro: tira de días con el examen
marcado, cuenta atrás y tres pestañas.

- **Temas de estudio**: lista numerada; cada tema se abre cuando el anterior
  está completo.
- **Progreso**: dominio medio, calificación objetivo, racha, lecciones hechas,
  meta diaria y el mes en curso.
- **Archivos**: el material subido, con opción de añadir más.

`exam/topic.tsx` dibuja el tema como un árbol de burbujas conectadas, con
separadores por nivel. Las lecciones se abren en orden y cada una completada
mueve el porcentaje de dominio del tema y del plan.

### Cuaderno (`app/(tabs)/class.tsx`)

Cuadernos con nombre —lo único obligatorio—, materia opcional, días y
visibilidad (privado por defecto). «Crear cuaderno» abre el asistente de cuatro
pasos (`class/new.tsx`: nombre, materia, días, público o privado) y «Unirme»
pide el código de seis caracteres de un cuaderno ajeno. Al entrar
(`class/[id].tsx`) hay tres pestañas: **Novedades** (tablón con anuncios,
tareas y material), **Trabajo** (solo las tareas) y **Personas**, donde se ve
la visibilidad del cuaderno.

### Perfil (`app/(tabs)/profile.tsx`)

Avatar, nombre y escuela, plan, tarjeta de progreso (racha de la semana y
métricas), botón propio para el calendario y la entrada a todos los ajustes.
Cerrar sesión borra el perfil y sus datos del dispositivo; las preferencias de
la app se quedan.

## Estado y persistencia

Todo el estado que sobrevive al cierre pasa por `usePersistentState`, una capa
sobre AsyncStorage con tres propiedades que importan:

1. **Sincroniza instancias.** Varias pantallas montadas a la vez pueden leer la
   misma clave; al escribir una, las demás se enteran por un bus de listeners.
2. **Encola escrituras tempranas.** Leer del disco es asíncrono. Los cambios que
   ocurren en ese hueco se apuntan y se reaplican sobre lo que venía guardado,
   en vez de perderse cuando llega la hidratación.
3. **Tolera datos corruptos.** El JSON que no parsea se ignora y se cae al valor
   inicial.

Devuelve `[value, setValue, hydrated]`. El tercer valor sirve para no dibujar
un «no existe» mientras aún se está leyendo.

### Claves

| Clave | Contenido |
| --- | --- |
| `foxy:theme-preference` | `system` · `light` · `dark` |
| `foxy:session` | proveedor y fecha de inicio de sesión |
| `foxy:onboarding-seen` | si ya se vio la introducción |
| `foxy:profile-setup-done` | si ya se completó el primer inicio (setup) |
| `foxy:user-name`, `foxy:avatar` | perfil |
| `foxy:account` | rango de edad |
| `foxy:subjects`, `foxy:selected-subject` | materias activas y la elegida |
| `foxy:school`, `foxy:grade` | escuela, etapa, nivel, grupo y turno |
| `foxy:study-plans` | preparaciones de examen completas |
| `foxy:classrooms` | cuadernos y sus publicaciones |
| `foxy:conversations` | conversaciones agrupadas por materia |
| `foxy:chat` | formato viejo del chat: solo sirve para migrar y queda vacío |
| `foxy:questions`, `foxy:pending-question` | historial y pregunta reenviada |
| `foxy:answer-mode` | forma de respuesta preferida |
| `foxy:activity-log` | sesiones de estudio |
| `foxy:streak` | racha, mejor racha y congelaciones |
| `foxy:events` | eventos del calendario |
| `foxy:focus-session` | temporizador |
| `foxy:plan`, `foxy:usage` | suscripción y cupo diario |
| `foxy:learning`, `foxy:notifications` | preferencias |

`STORAGE_KEYS` es la lista completa; `SESSION_KEYS` es el subconjunto que se
borra al cerrar sesión (el perfil y sus datos, no las preferencias de la app).

## Modelos

**`StudyPlan`** (`hooks/use-study-plans.ts`) — `title`, `subject`, `examDate`,
`targetGrade` (50–100), `language`, `materials`, `topics`, `survey`, `hidden`.
Cada `PlanTopic` tiene `level` y una lista de `PlanLesson` con `kind`
(`intro` · `practica` · `quiz` · `reto`), `level`, `done` y `doneAt`.

Derivados: `planProgress`, `topicProgress`, `isTopicUnlocked`,
`isLessonUnlocked`, `nextTopicIndex`, `dailyLessonGoal`, `lessonsDoneToday`.
El número de temas depende de los días que falten para el examen, y la meta
diaria reparte lo que queda entre esos días con un tope de 12.

**`Classroom`** (`hooks/use-classrooms.ts`) — nombre, materia opcional, días,
visibilidad (`privado` por defecto vía `roomVisibility()`) y código de seis
caracteres, más `posts`, donde cada `ClassPost` es un `anuncio`, una `tarea` o
un `material`.

**`Conversation` / `ChatMessage`** (`features/chat/hooks/use-chat.ts`) — cada
conversación pertenece a una materia y guarda sus mensajes: `role` (`user` ·
`foxy`), texto, fecha y adjuntos. `send` crea conversación nueva si la materia
cambia; `answer` compone la respuesta de Foxy rotando redacciones; `groups`
expone la lista agrupada por materia y ordenada por actividad. Al hidratar, el
formato viejo (`foxy:chat`, un array plano) se migra solo a conversaciones por
materia.

**`FocusSession`** (`hooks/use-focus-session.ts`) — `minutes`, `endsAt`,
`remaining` y `finished`. El reloj se calcula siempre desde `endsAt`, nunca
restando segundos, porque los intervalos se congelan en segundo plano. Al llegar
a cero la sesión se cierra sola y deja `finished` para que el vigilante de la
raíz lo apunte.

**`AgendaEvent`** (`hooks/use-agenda.ts`) — título, materia, fecha, hora y
`kind` (`examen` · `tarea` · `clase` · `repaso`). Aquí viven también
`localDay`, `daysUntil`, `buildMonthGrid`, `MONTH_NAMES` y `WEEKDAY_LABELS`, que
usa todo lo que toca fechas.

## Diseño

`constants/theme.ts` tiene la paleta (`Palette`), los dos esquemas (`Colors`) y
los temas de navegación. Rojo `#EF4444` es el color de marca; azul, morado y
naranja acompañan. `contexts/theme-context.tsx` expone `colors`, `isDark` y la
preferencia.

Las clases de NativeWind cubren lo estructural y los colores fijos
(`bg-bg-light dark:bg-bg-dark`, `text-text-primary-light`…). Los colores que
dependen del tema o de la materia van por `style`, porque una clase no puede
resolverse en tiempo de ejecución.

`getSubjectAccent` (`constants/subject-colors.ts`) asigna a cada materia un
color estable a partir de un hash del nombre, con variante clara y oscura. Es lo
que hace que una materia se vea siempre del mismo color en toda la app.
`softTint(color, isDark)` genera el relleno suave de ese acento.

### Componentes reutilizables

| Componente | Para qué |
| --- | --- |
| `settings-ui.tsx` | `ScreenShell`, `Card`, `Row`, `SwitchRow`, `ChipGroup`, `SectionTitle`, `Note`, `PromptModal`, `softTint` |
| `screen-header.tsx` | `AppHeader` (racha · meta o temporizador · plan), `TabHeader` y `useScreenPadding` |
| `grade-dial.tsx` | dial circular 50–100 con arrastre y botones ± |
| `progress-ring.tsx` | anillo de progreso de un solo trazo |
| `goal-bar.tsx` | barra de dominio con la marca de la calificación objetivo |
| `month-calendar.tsx` | mes navegable, con día del examen y selección |
| `wheel-picker.tsx` | rueda de selección con encaje e impulso |
| `time-picker-sheet.tsx` | reloj de hora, minutos y a. m. / p. m. |
| `next-lesson-sheet.tsx` | formatos de lección (Aprender · Practicar · Examen) |
| `plan-settings-sheet.tsx` | información y ajustes de una preparación |
| `avatar-editor.tsx` | foto de perfil con cámara, galería y quitar |
| `portal.tsx`* | `PortalHost`, `AppModal` (sustituto de `Modal`) y `SheetSlide` |
| `overlay.tsx`* | `showDialog`, `showSheet`, `showPrompt`, `appAlert`, `reportToUser` |
| `chat-composer.tsx`* | panel de entrada compartido: materia, adjuntos, opciones |
| `chat-bubble.tsx`* | mensaje del hilo con adjuntos y hora |

\* Viven en `features/shared/components` y `features/chat/components`.

### Hojas, diálogos y teclado

Nada usa el `Modal` nativo ni `Alert.alert`. Las hojas inferiores van por
`AppModal` (`features/shared/components/portal.tsx`), que se superpone dentro
del mismo árbol de React: en Android, la ventana de sistema aparte dejaba los
avisos propios detrás y hacía perder el resultado del selector de fotos. El
fondo entra en fundido y el panel sube deslizando (`SheetSlide`, 260 ms); no
hay animación de salida. Los diálogos centrados y las hojas compartidas viven
en `features/shared/components/overlay.tsx`.

Con el teclado ocurre lo descrito arriba: la ventana no se reajusta y el alto
que informa Android deja fuera la barra de navegación. `useKeyboardHeight()`
toma el mayor entre el alto reportado y el que se deduce de la posición del
teclado en pantalla; `useSheetPaddingBottom()` suma además `insets.bottom`.
Las barras fijas de los asistentes y las pantallas con input suman ese alto a
su padding.

Para abrir algo justo después de cerrar una hoja conviene esperar a que
termine el ciclo (~260 ms): el selector nativo puede quedar detrás de la
ventana que se está cerrando.

## Utilidades

`lib/media.ts` — `persistMedia` copia lo que devuelven la cámara, la galería y
el selector de archivos a la carpeta de documentos de la app. El selector los
deja en una caché que el sistema puede vaciar, así que sin esta copia las
imágenes guardadas se rompen con el tiempo. `deleteMedia` limpia lo que ya no se
usa.

`lib/time.ts` — conversión entre el formato de 24 horas que se guarda y el de 12
que se muestra: `parseTime`, `toTimeString`, `formatTime12`, y las opciones de
las ruedas.

`constants/subjects.ts` — catálogo base de materias (`DEFAULT_SUBJECTS`) y tres
ayudantes: `normalizeSubject` (compara sin tildes), `searchSubjects` (filtro
tolerante para buscadores) y `mergeSubjects`, que une catálogo y materias del
usuario sin repetir tras normalizar.

`constants/school.ts` — etapas (primaria, secundaria, universidad) con sus
niveles y sustantivo, grupos, turnos y `describeGrade`.

`constants/attachments.ts` — formatos admitidos, tamaño máximo y ayudas de
nombre, incluida `isOpaqueFileName` para reemplazar los nombres que la galería
de Android devuelve como identificadores.

## Convenciones

- Android en vertical es el único destino que se prueba; el layout se valida en
  un teléfono real, no en el navegador.
- Interfaz en español, incluidas las etiquetas de accesibilidad.
- Todo control interactivo lleva `accessibilityRole` y `accessibilityLabel`; los
  que tienen estado añaden `accessibilityState`.
- La navegación por toque pasa por `useGuardedRouter` (enfriamiento contra el
  doble toque). `useRouter` directo solo vive en el splash y en el `AuthGate`.
- Sin `Modal` ni `Alert.alert` nativos: las hojas van por `AppModal` +
  `SheetSlide` y los avisos por `appAlert`.
- Nada de valores de color sueltos en las pantallas: salen de `Palette`,
  `colors` o `getSubjectAccent`.
- La entrada de datos se elige de una lista siempre que el dominio sea cerrado
  (grado, grupo, turno, materia, días, horas). El texto libre se reserva para
  nombres propios.
- Los formatos de fecha y hora se generan con los ayudantes de `use-agenda` y
  `lib/time`, no a mano.
- Las pantallas que leen de disco esperan `hydrated` antes de decir que algo no
  existe.
