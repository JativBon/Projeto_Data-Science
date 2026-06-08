# Pipeline de Figuras Frontend para Relatório

## Objetivo

As figuras principais do relatório PDF passam a ser capturas das mesmas vistas usadas no frontend. As imagens técnicas geradas pelo backend continuam disponíveis como evidência formal em anexo, juntamente com CSV/JSON/DOT.

## Mapeamento

| Figura do relatório | Vista frontend usada | Ficheiro exportado |
| --- | --- | --- |
| Grafo observado completo | `?view=graph` | `observed_graph_frontend.png` |
| RAMEX 2007 formal / árvore técnica | `?view=pure&pureTab=ramex2007` | `ramex2007_graph_frontend.png` |
| Sankey RAMEX 2007 | `?view=sankey&sankeyMode=ramex2007` | `ramex2007_sankey_frontend.png` |
| Sankey Forward | `?view=sankey&sankeyMode=forward` | `forward_sankey_frontend.png` |
| Sankey Back-and-Forward Formal top 50 | `?view=sankey&sankeyMode=polytree&polytreeView=interpretive` | `back_forward_sankey_frontend_top50.png` |
| Sankey Back-and-Forward Formal completo | `?view=sankey&sankeyMode=polytree&polytreeView=complete` | `back_forward_sankey_frontend_full.png` |
| Poly-tree formal | `?view=pure&pureTab=backforward` | `polytree_frontend.png` |
| RAMEX-Forum temporal Fase 1 | `?view=forum` / bloco `temporal-phase1` | `temporal_phase1_frontend.png` |
| RAMEX-Forum temporal Fase 2 | `?view=forum` / bloco `temporal-phase2` | `temporal_phase2_frontend.png` |

## Pastas

- Fonte organizada do relatório: `reports/assets/frontend_exports/`
- Subpasta por dataset/job: `reports/assets/frontend_exports/<id>/`
- Espelho público usado pelo frontend/PDF: `frontend-ramex/public/reports/assets/frontend_exports/<id>/`

## Comandos

```powershell
cd frontend-ramex
npm.cmd install
npx.cmd playwright install chromium
npm.cmd run export:report-assets -- --dataset 03 --id dataset03
npm.cmd run build
```

Depois de gerar as imagens, o botão **Exportar relatório (PDF)** usa automaticamente os ficheiros em `/reports/assets/frontend_exports/<id>/` como figuras principais. Se uma imagem frontend não existir, o PDF mantém fallback para as figuras backend.
