FROM python:3.13-slim AS build
WORKDIR /app
COPY pyproject.toml ./
RUN pip install --no-cache-dir --prefix=/install .

FROM python:3.13-slim
WORKDIR /app
COPY --from=build /install /usr/local
COPY app ./app
# uvicorn lee por sí solo cualquier opción suya con el prefijo UVICORN_, así que
# el bind se configura sin flags y el nombre dice quién lo consume.
# UVICORN_HOST=127.0.0.1 deja el proceso alcanzable solo desde su propia máquina.
ENV UVICORN_HOST=0.0.0.0
ENV UVICORN_PORT=8000
EXPOSE 8000
# Forma exec, sin `sh -c`: uvicorn es PID 1 y recibe el SIGTERM del orquestador.
# Con la shell delante nadie se lo reenvía y el apagado ordenado no ocurre.
#
# --factory: la app se construye al arrancar, no al importar el módulo, así un
# fallo de configuración es un arranque fallido y no un traceback de import.
CMD ["uvicorn", "app.main:create_app", "--factory"]
