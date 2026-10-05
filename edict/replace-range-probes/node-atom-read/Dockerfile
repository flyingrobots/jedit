FROM rust:1.95.0-bookworm AS compiler
RUN apt-get update && apt-get install -y --no-install-recommends python3 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /edict
RUN git init && git remote add origin https://github.com/flyingrobots/edict.git \
    && git fetch --depth=1 origin 2405a550e93e1e97fff640caa44bbd0f65ffff3c \
    && git archive FETCH_HEAD | tar -x
RUN cargo build --locked -p edict-cli
WORKDIR /echo-source
RUN git init && git remote add origin https://github.com/flyingrobots/echo.git \
    && git fetch --depth=1 origin 49e9efb68001dfd78563d18bac9359a87671e431 \
    && git archive FETCH_HEAD schemas/edict-provider/package/v1 | tar -x

FROM rust:1.90.0-bookworm AS provider
WORKDIR /echo
RUN git init && git remote add origin https://github.com/flyingrobots/echo.git \
    && git fetch --depth=1 origin 84ccbcec0640f2c7d0565464fd55655007689b42 \
    && git archive FETCH_HEAD | tar -x
RUN cargo run --locked -p echo-wesley-gen --example ordered_publication_witness -- /ordered-provider

FROM compiler AS witness
COPY --from=provider /ordered-provider /ordered-provider
COPY edict/replace-range-probes/node-atom-read /probe
CMD ["python3", "/probe/run.py"]
