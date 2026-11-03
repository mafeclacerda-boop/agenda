# Cultivar

Aplicativo pessoal de organização e planejamento semanal, em português, que transforma
objetivos de vida em pequenas ações diárias e semanais.

Funciona no navegador do computador e do celular e pode ser instalado como aplicativo (PWA).
Não tem login, nuvem, inteligência artificial nem integrações externas.

## Seções

- **Hoje** (página inicial): data, uma frase acolhedora, hábitos previstos para o dia, até três
  prioridades, outras tarefas e um campo para adicionar tarefas com Enter. Tarefas de dias
  anteriores que ficaram em aberto aparecem num bloco recolhido, sem mudar de data sozinhas.
- **Minha semana**: sete cartões de segunda a domingo, com o dia atual em destaque, mais a caixa
  **Depois** para tarefas sem data. Dá para arrastar tarefas entre os dias (no celular, pela alça
  ⋮⋮ à esquerda), reagendar pelo botão de calendário, adicionar direto em um dia e navegar
  entre semanas. Cada cartão mostra o total de minutos estimados (é só uma soma de durações,
  não tempo livre).
- **Meus objetivos**: criar, editar, pausar, arquivar e excluir objetivos. Cada um tem nome,
  frase opcional de motivação, cor, hábitos recorrentes (↻) e tarefas pontuais (●). O progresso
  aparece como “4 de 7 dias” ou “60 de 90 minutos”, sem porcentagens.

## Hábitos

- Cada hábito se repete nos dias da semana escolhidos.
- Hábitos com meta em minutos podem ser concluídos com um clique ou ter minutos parciais
  registrados. Cada dia é guardado separadamente e pode ser alterado ou desmarcado sem afetar
  os outros.
- Hábitos e ações semanais aceitam link e nota; cada dia também aceita uma nota própria.

## Configuração inicial (editável)

| Objetivo | Para quê | Recorrência |
| --- | --- | --- |
| Espiritualidade | Fortalecer minha conexão com Deus. | Oração, 30 min, todos os dias |
| Leitura | Cultivar a leitura. | Leitura, 30 min, todos os dias |
| Atualização profissional | Manter-me atualizada para tomar melhores decisões nos negócios. | Ler o relatório da Maria Clara Aromas (segundas, 30 min) e da Cruzeiro Manipulação (terças, 30 min) |

Os relatórios não são acessados pelo app: use o campo de link e nota de cada ação para guardar
onde eles estão.

## Dados e backup

- Tudo fica salvo no `localStorage` **deste navegador, neste dispositivo**.
- Não há sincronização automática: celular e computador têm dados separados.
- Em **Configurações** (ícone no canto superior direito) dá para exportar e importar um backup
  completo em JSON. Importar substitui os dados atuais.
- Datas usam o fuso local, e a semana começa na segunda-feira.

## Como rodar

São só arquivos estáticos, sem etapa de build e sem dependências.

```bash
# qualquer servidor estático serve; por exemplo:
python3 -m http.server 8080
# depois abra http://localhost:8080
```

Para instalar como aplicativo, o site precisa ser servido por HTTPS (ou `localhost`). Pode ser
publicado de graça no GitHub Pages, Netlify, Vercel ou Cloudflare Pages apontando para a raiz
deste repositório.

## Estrutura

```
index.html             estrutura da página
css/styles.css         visual (creme, sálvia, lavanda)
js/app.js              dados, telas e ações
manifest.webmanifest   configuração do PWA
sw.js                  service worker (abre sem internet)
icons/                 ícones do aplicativo
```

Ao alterar arquivos do app, aumente a versão em `CACHE` no `sw.js` para que quem já instalou
receba a atualização.
