# Recursos visuais (scripts/assets/)

Scripts que baixam ou preparam recursos externos. Registre a origem e a licença de cada recurso em `assets/CREDITOS.md` e na aba "Contexto e normas".

## baixar_polyhaven.py (Fase 4)

Baixa da API pública do Poly Haven (sem conta nem chave) o HDRI de céu diurno parcialmente nublado em 2K e 4K para `public/hdri/` (`ceu_2k.hdr`, `ceu_4k.hdr` e `ceu.json` com id, autores, licença e data). Só usa a biblioteca padrão do Python 3.

```
python scripts/assets/baixar_polyhaven.py                # HDRI padrão: kloofendal_48d_partly_cloudy_puresky
python scripts/assets/baixar_polyhaven.py --id <id>      # outro HDRI do Poly Haven
```

O app usa o 2K para a luz ambiente e o fundo (qualidades baixa e média) e o 4K só no fundo da qualidade alta. Prefira céus "pure sky" (sem chão fotografado): o chão é o terreno do modelo. Ao trocar de HDRI, atualize os créditos.
