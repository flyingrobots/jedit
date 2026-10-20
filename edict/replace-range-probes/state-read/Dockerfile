FROM rust:1.95.0-bookworm AS compiler
WORKDIR /edict
RUN git init && git remote add origin https://github.com/flyingrobots/edict.git \
    && git fetch --depth=1 origin 77f4a91080a6c2c875fe349da6fc6a64525947a2 \
    && git checkout --detach FETCH_HEAD \
    && cargo build --locked -p edict-cli

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates git python3 && rm -rf /var/lib/apt/lists/*
WORKDIR /echo
RUN git init && git remote add origin https://github.com/flyingrobots/echo.git \
    && git fetch --depth=1 origin 49e9efb68001dfd78563d18bac9359a87671e431 \
    && git checkout --detach FETCH_HEAD \
    && cp -R schemas/edict-provider/package/v1 /echo-provider
COPY --from=compiler /edict/target/debug/edict /usr/local/bin/edict
COPY edict/replace-range-probes/state-read /probe
CMD ["python3", "/probe/run.py"]
