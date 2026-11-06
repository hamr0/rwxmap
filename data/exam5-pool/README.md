# exam5-pool

`rwxlite-providers.csv` is rwxlite's full provider list: every provider in their
123k-operation APIs.guru-derived corpus (`data/m0/mechanical.jsonl.gz`) plus every
labelled set under rwxlite `data/`. 902 providers plus a header.

Columns: `provider,aliases,rows,sources`.

Received 2026-11-06 from the rwxlite session. Byte-identical copy; check with
`sha256sum -c rwxlite-providers.csv.sha256`.

Their caveats:
- Values are as stored; some are `*.local` names that are not registrable.
- APIs.guru keys like `amazonaws.com:ec2` are folded: the provider is the domain and the service goes in aliases.
- Brand aliases beyond those fields are not included, so apply our own registrable-name and brand-alias matching on top.

Use: exam #5 vendors must be absent from this list (see docs/wiki/truth-v4-plan.md, step 7).
