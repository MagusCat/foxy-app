# Fox 🦊 — app móvil

App de estudio para estudiantes de secundaria y universidad. Reúne en un solo
sitio las cuatro cosas que un estudiante hace a diario: preguntar dudas,
preparar exámenes, seguir sus clases y medir el tiempo que dedica a estudiar.

Expo SDK 54 · React Native 0.81 (nueva arquitectura) · expo-router ·
NativeWind 4 · TypeScript estricto.

## Empezar

```bash
npm install
```

```bash
npm start
```

Escanea el QR con Expo Go, o pulsa `a` / `i` para abrir un emulador. Para
compilar el paquete nativo:

```bash
npm run android
```

Otros comandos:

| Comando | Para qué |
| --- | --- |
| `npm run web` | Levanta la app en el navegador (útil para inspeccionar layout) |
| `npm run lint` | ESLint con la configuración de Expo |
| `npx tsc --noEmit` | Comprueba tipos sin generar nada |
| `npx expo export --platform android` | Empaqueta todo el grafo; detecta imports roto antes de probar en el teléfono |

## Estructura

```
app/                      pantallas, enrutadas por archivo (expo-router)
  _layout.tsx             Stack raíz, proveedores y AuthGate
  (auth)/                 splash · onboarding · login
  (tabs)/                 Preguntar · Exámenes · Clase · Perfil
  exam/new.tsx            asistente de creación de preparación
  exam/[id].tsx           preparación: temas, progreso y archivos
  exam/topic.tsx          árbol de lecciones de un tema
  class/[id].tsx          salón por dentro
  calendar.tsx            calendario propio con eventos y exámenes
  activity.tsx            racha, minutos e historial
  focus.tsx               temporizador de estudio
  history.tsx             preguntas guardadas
  achievements.tsx        logros
  subscription.tsx        planes
  settings/               cuenta · escuela · aprendizaje · notificaciones · privacidad · ayuda
components/               interfaz reutilizable
hooks/                    estado persistido y lógica de dominio
constants/                paleta, catálogos y tablas fijas
contexts/                 tema y sesión
lib/                      utilidades sin React
```

## Navegación

El Stack raíz vive en `app/_layout.tsx`. `AuthGate` mira `isSignedIn` del
contexto de sesión y redirige: sin sesión va a `(auth)/splash`, con sesión a
`(tabs)`. El splash nativo se mantiene hasta que se resuelve esa decisión, para
que no se vea un parpadeo de pestañas.

Todas las pantallas apiladas traen su propio encabezado, así que el del
navegador está oculto en el Stack (`headerShown: false`).

`FocusCompletionWatcher` también se monta en la raíz: es el único punto que
registra en la actividad las sesiones de enfoque que llegan a cero, para que se
apunten una sola vez por muchas pantallas que tengan el temporizador abierto.

## Las cuatro pestañas

### Preguntar (`app/(tabs)/index.tsx`)

Es un chat. La pantalla tiene dos estados: portada, cuando el hilo está vacío
(saludo, botón *Comenzar* y accesos a la meta del día y al próximo evento), e
hilo de conversación en cuanto hay un mensaje.

El panel de entrada está anclado abajo, fuera del scroll, y admite texto,
cámara, galería y archivos. Debajo del campo se elige la
materia y el modo de respuesta. Enviar registra la pregunta en el historial,
suma a la racha y arranca el temporizador de enfoque si no había ninguno
corriendo.

### Exámenes (`app/(tabs)/exams.tsx`)

Lista las preparaciones con su barra de dominio y la marca de la calificación
objetivo, más la tarjeta de la escuela. Desde aquí se crea una preparación
nueva y se busca entre las existentes.

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

### Clase (`app/(tabs)/class.tsx`)

Salones con nombre, materia, profesor, días y hora. Cada salón tiene un código
de seis caracteres para invitar. Al entrar (`class/[id].tsx`) hay un banner con
el color de la materia y tres pestañas: **Novedades** (tablón con anuncios,
tareas y material), **Trabajo** (solo las tareas) y **Personas**.

### Perfil (`app/(tabs)/profile.tsx`)

Avatar y nombre, plan, racha de la semana, tres métricas rápidas y la entrada a
todos los ajustes.

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
| `foxy:user-name`, `foxy:avatar` | perfil |
| `foxy:account` | correo del adulto y rango de edad |
| `foxy:subjects`, `foxy:selected-subject` | materias activas y la elegida |
| `foxy:school`, `foxy:grade` | escuela, etapa, grado, grupo, tutor y turno |
| `foxy:study-plans` | preparaciones de examen completas |
| `foxy:classrooms` | salones y sus publicaciones |
| `foxy:chat` | hilo de conversación |
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

**`Classroom`** (`hooks/use-classrooms.ts`) — datos del salón más `posts`, donde
cada `ClassPost` es un `anuncio`, una `tarea` o un `material`.

**`ChatMessage`** (`hooks/use-chat.ts`) — `role` (`user` · `foxy`), texto,
materia, fecha y adjuntos. `send` añade el mensaje del usuario; `answer` compone
la respuesta de Foxy rotando entre las redacciones de `REPLIES`.

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
| `screen-header.tsx` | `TabHeader` y `useScreenPadding` (arriba, sobre la barra de pestañas, sobre el borde inferior) |
| `grade-dial.tsx` | dial circular 50–100 con arrastre y botones ± |
| `progress-ring.tsx` | anillo de progreso de un solo trazo |
| `goal-bar.tsx` | barra de dominio con la marca de la calificación objetivo |
| `month-calendar.tsx` | mes navegable, con día del examen y selección |
| `wheel-picker.tsx` | rueda de selección con encaje e impulso |
| `time-picker-sheet.tsx` | reloj de hora, minutos y a. m. / p. m. |
| `next-lesson-sheet.tsx` | formatos de lección (Aprender · Practicar · Examen) |
| `plan-settings-sheet.tsx` | información y ajustes de una preparación |
| `avatar-editor.tsx` | foto de perfil con cámara, galería y quitar |
| `chat-bubble.tsx` | mensaje del hilo con adjuntos y hora |

### Hojas y teclado

Las hojas inferiores usan `Modal` con `transparent`, `statusBarTranslucent` y
`navigationBarTranslucent`, y toman su hueco de abajo de
`useSheetPaddingBottom()`. Ese hook resuelve el detalle que más problemas da en
Android: la ventana no se reajusta con el teclado y el alto que informa el
evento deja fuera la barra de navegación, así que hay que sumar
`insets.bottom`. Cualquier barra anclada al borde inferior debe usarlo.

Para abrir algo justo después de cerrar una hoja hay que esperar a que termine
la animación (unos 260 ms). En iOS no se puede presentar un modal mientras otro
se cierra, y en Android el selector nativo queda detrás.

## Utilidades

`lib/media.ts` — `persistMedia` copia lo que devuelven la cámara, la galería y
el selector de archivos a la carpeta de documentos de la app. El selector los
deja en una caché que el sistema puede vaciar, así que sin esta copia las
imágenes guardadas se rompen con el tiempo. `deleteMedia` limpia lo que ya no se
usa.

`lib/time.ts` — conversión entre el formato de 24 horas que se guarda y el de 12
que se muestra: `parseTime`, `toTimeString`, `formatTime12`, y las opciones de
las ruedas.

`constants/subjects.ts` — catálogo de 40 materias y `mergeSubjects`, que lo une
con las del usuario sin repetir.

`constants/school.ts` — etapas (primaria, secundaria, universidad) con sus
niveles y sustantivo, grupos, turnos y `describeGrade`.

`constants/attachments.ts` — formatos admitidos, tamaño máximo y ayudas de
nombre, incluida `isOpaqueFileName` para reemplazar los nombres que la galería
de Android devuelve como identificadores.

## Convenciones

- Interfaz en español, incluidas las etiquetas de accesibilidad.
- Todo control interactivo lleva `accessibilityRole` y `accessibilityLabel`; los
  que tienen estado añaden `accessibilityState`.
- Nada de valores de color sueltos en las pantallas: salen de `Palette`,
  `colors` o `getSubjectAccent`.
- La entrada de datos se elige de una lista siempre que el dominio sea cerrado
  (grado, grupo, turno, materia, días, horas). El texto libre se reserva para
  nombres propios.
- Los formatos de fecha y hora se generan con los ayudantes de `use-agenda` y
  `lib/time`, no a mano.
- Las pantallas que leen de disco esperan `hydrated` antes de decir que algo no
  existe.
