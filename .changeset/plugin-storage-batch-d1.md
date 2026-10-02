---
"emdash": patch
---

Fixes `PluginStorageRepository.getMany` and `deleteMany` to stay within D1's 100 bound-parameter limit by chunking large `IN (...)` lists. Plugin retention purges and other batch storage operations now work regardless of how many ids are passed.
