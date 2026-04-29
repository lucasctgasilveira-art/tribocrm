# Bloco 5 — Operação e Medição

> Manual operacional pra rodar o plano semana após semana.
> Construído sobre [B1](./01-estrategia-canal.md) · [B2](./02-pautas-e-calendario.md) · [B3](./03-sistema-visual.md) · [B4](./04-pipeline-automacao.md).

---

## Princípio condutor da operação

**Concentrar produção numa janela só, deixar publicação no automático, e manter relação humana viva.**

PME não tem time de marketing dedicado. O plano só sobrevive se a operação semanal couber em 5-6h focadas + 15min/dia de stories e DMs ao vivo. Tudo que pode ser agendado é agendado. Tudo que precisa de presença (DM qualificada, comentário com contexto, story de bastidor) é feito no momento certo.

---

## 1. Workflow semanal

### Cadência fixa

| Quando | Tempo | O quê | Notas |
|---|---|---|---|
| **SEX 16-19h** | 3h | Produção da próxima semana: escolher pautas, escrever copies, renderizar PNGs (`npm run posts:all`), revisar | Janela protegida — sem interrupção |
| **SAB ou DOM** | 1-2h | Gravar/editar os 2 reels da próxima semana | Câmera de celular + iMovie/CapCut basta |
| **DOM 20-21h** | 1h | Carregar PNGs no agendador, programar horários, escrever legendas finais | Foco total no agendamento |
| **TER 9h** | 30min | Triagem de DMs qualificadas da semana anterior · respostas pessoais | DM qualificada = pessoa que pergunta sobre método ou produto |
| **QUI 9h** | 30min | Olhar dashboard de KPI da semana anterior · anotar aprendizado | Não é hora de mudar plano — só registrar |
| **TODOS DIAS** | 15-20min | Stories ao vivo (manhã ou tarde) + responder comentários do dia | Pode rodar enquanto toma café / no fim do expediente |

**Total fixo:** ~5-6h focadas + ~2h dispersas em stories/DMs = ~8h/semana

### Ordem dentro da janela de produção (SEX 16-19h)

```
16:00 → Abrir [02-pautas-e-calendario.md] · ler pautas da próxima semana
16:10 → Atualizar/criar 5 YAMLs em marketing/instagram/posts/
16:30 → cd marketing/instagram && npm run posts:all
16:35 → Abrir output/ · review visual · ajustar YAMLs se preciso · re-render
17:15 → Escrever 5 legendas em texto (carrossel + reel + feed)
18:15 → Passar checklist de publicação por cada peça (§4)
18:45 → Salvar tudo em pasta da semana · arquivar nada que ficar fora
```

### Reels (sábado ou domingo)

```
1. Abrir o YAML do reel-cover da próxima semana
2. Ler o roteiro escrito (ou criar a partir das estruturas-padrão do B2)
3. Gravar com celular num lugar com boa luz (10-15min de gravação)
4. Editar em CapCut ou iMovie — adicionar lower-thirds
5. Render do reel-cover.png já tá pronto (Bloco 4) — usa como capa
6. Exportar em 1080×1920 mp4
```

### Stories ao vivo (durante a semana)

Não agenda — faz no momento.

| Tipo | Quando | Tempo |
|---|---|---|
| Story-enquete | SAB de manhã | 5min (renderiza com pipeline + posta) |
| Story-bastidor | Qualquer hora que algo aconteça | 5-10min |
| Story-recap | SAB final do dia | 15min (compila prints da semana) |
| Resposta a DM (com permissão) | Quando rolar uma DM boa | 5min |

---

## 2. Ferramenta de agendamento

### Comparação

| Critério | Metricool | Postgrain | Buffer / Later |
|---|---|---|---|
| **Publica IG direto** (sem notificação) | ✅ | ✅ | ⚠️ depende do plano |
| **Carrossel nativo** | ✅ | ✅ | ✅ |
| **Stories agendados** | ✅ | ✅ | ⚠️ |
| **Inbox unificado** (DMs + comentários) | ✅ | ⚠️ limitado | ⚠️ |
| **Analytics IG** | ✅ robusto | ✅ bom | ⚠️ |
| **Interface PT-BR** | ✅ | ✅ nativo | ❌ |
| **Plano gratuito** | ✅ generoso | ❌ só trial | ✅ limitado |
| **Plano pago entrada** | ~R$ 70/mês | ~R$ 50/mês | ~R$ 30/mês |
| **Suporte BR** | ✅ | ✅ nativo | ❌ |

### Recomendação

**Metricool como primeira escolha**, pelo combo plano gratuito robusto + inbox unificado + analytics IG decente. Permite começar grátis e migrar pra Starter quando o volume crescer.

**Postgrain como alternativa** se você prefere ferramenta brasileira pura ou se o ponto de dor for preço (Lite mais barato que Metricool Starter).

**Não recomendo Buffer/Later** pra esse caso — desenhados pra mercado US, suporte fraco em PT, analytics IG menos rico.

### Setup recomendado (Metricool)

1. Criar conta em metricool.com (plano gratuito)
2. Conectar perfil `@tribocrmoficial` via Meta Business
3. Criar pasta de projeto "TriboCRM IG"
4. Importar PNGs de `marketing/instagram/output/`
5. Programar horários conforme calendário do B2

### Horários recomendados

Pra PME brasileira (Caio + Bruna), feed do IG vê mais movimento em:

| Dia | Horário primário | Horário backup |
|---|---|---|
| SEG | 7:00-8:00 (antes do trabalho) | 12:00-13:00 |
| TER | 7:00-8:00 | 18:00-19:00 |
| QUA | 12:00-13:00 (almoço) | 19:00-20:00 |
| QUI | 7:00-8:00 | 18:30-19:30 |
| SEX | 11:00-12:00 (pré-almoço) | 17:00-18:00 |
| SAB | 10:00-11:00 (story) | 16:00-17:00 |

**Calibragem:** depois de 2 semanas, abrir analytics e ver quais horários converteram mais salvamentos. Mover horários do calendário pra esses.

---

## 3. Dashboard de KPIs

### Estratégia híbrida

- **Metricool** capta dado bruto automático (alcance, saves, comentários por peça)
- **Planilha mensal** agrega + cruza com pilar/formato/horário pra tomada de decisão

### Estrutura da planilha

#### Aba "Posts" (uma linha por peça publicada)

| Campo | Tipo | Exemplo |
|---|---|---|
| Data | data | 04/05/2026 |
| Slug | texto | 2026-05-04_funil_01-capa |
| Pilar | enum | Método / Dor / Bastidor / Manifesto · (Prova suspenso 28/04/2026 — só após cliente real com permissão) |
| Formato | enum | carrossel / reel / feed / story |
| Hook | texto | "Os 4 momentos do funil que sua PME tá pulando" |
| Alcance | número | 4.850 |
| Salvamentos | número | 78 |
| Saves/1k alcance | fórmula | =Salvamentos/(Alcance/1000) → 16,1 |
| Comentários qualificados | número | 4 |
| DMs qualificadas | número | 2 |
| Cliques link bio | número | 11 |
| Compartilhamentos | número | 9 |
| Notas | texto | "Performou bem · pilar Método com hook específico funcionou" |

#### Aba "Semana" (agregado por semana)

| Campo | Cálculo |
|---|---|
| Semana | identificador (W18-2026) |
| Saves/1k médio | média(Posts.SavesPor1k da semana) |
| DMs qualificadas total | soma |
| Cliques link bio total | soma |
| Pilar campeão | pilar com maior média de Saves/1k |
| Formato campeão | formato com maior média |
| Notas | livre |

#### Aba "Mês" (consolidado mensal + meta)

| KPI | Meta M1 | Meta M2 | Meta M3 | Realizado M1 | Realizado M2 | Realizado M3 |
|---|---|---|---|---|---|---|
| Saves/1k | 8 | 14 | 22 | | | |
| DMs qualificadas/sem | 2 | 5 | 10 | | | |
| Cliques link bio/sem | 15 | 40 | 80 | | | |

#### Aba "Pilares" (cruzamento)

Tabela dinâmica: pilar × média Saves/1k × DMs gerados × volume de peças. Mostra qual pilar está puxando vs qual está custando volume sem retorno.

### Onde fica a planilha

- **Google Sheets:** mais fácil pra compartilhar com sócio/gestora
- **Excel local:** se você prefere offline

Sugestão: criar Google Sheets com as 4 abas e linkar daqui no plano-mestre.

### Cadência de atualização

- **Diário (não):** não vale o tempo
- **Semanal (sim, QUI 9h):** preencher linha de cada peça publicada na semana, atualizar aba "Semana"
- **Mensal (sim, último dia útil do mês):** consolidar aba "Mês" e fazer ciclo de revisão (§5)

---

## 4. Checklist de publicação

> **Passar essa lista por CADA peça antes de publicar. Pegou um "não", volta e ajusta.**

### Visual

- [ ] Símbolo D no canto inferior direito · 88px · não cortado
- [ ] Paleta respeitada (preto `#0a0a0a` · laranja `#f97316` · branco) — sem cinzas
- [ ] DM Sans usada em tudo (nada de Times, Arial, sistema default)
- [ ] Dimensão correta: feed 1080×1350 · story/reel 1080×1920
- [ ] Texto não corta nas bordas · espaçamento generoso preservado
- [ ] Numeração de slide (carrossel) está certa (`01 / 08`, `02 / 08`...)
- [ ] Handle `@tribocrmoficial` (nunca `@tribocrm`)

### Copy

- [ ] Vocabulário oficial: "a gente" · "Máquina de Vendas" · "vender de verdade" · "sistema" · "ferramenta" · "cliente" · "vendedor" · "equipe"
- [ ] **Sem palavras proibidas — coach/marketing:** ❌ "solução" · ❌ "plataforma" · ❌ "empoderar" · ❌ "transforme" · ❌ "descubra o segredo"
- [ ] **Sem jargão tech estrangeiro** (regra dura · 28/04/2026): ❌ "feature" → use "função" / "produto" · ❌ "deal" → use "negócio" / "venda" · ❌ "customer" → use "cliente" · ❌ "stakeholder" → use "decisor" / "quem aprova" · ❌ "squad" → use "time" / "equipe" · ❌ "onboarding" → use "primeiros dias" · ❌ "churn" → use "cancelamento" · ❌ "insight" → use "descoberta" / "percepção"
- [ ] **OK manter** (vocabulário comercial estabelecido em PT-BR de vendas B2B): pipeline · funil · follow-up · forecast · lead · pitch (em contextos específicos)
- [ ] Emojis: **só** 🔥 📈 ⚡ ✅
- [ ] **Sem emojis proibidos:** ❌ 🚀 💎 🏆 💪 ✨ 🤖 🎯
- [ ] Português correto · sem typos · acentuação correta · "tá/pra" mantém acento

### Especificidade (os dois testes do plano-mestre)

- [ ] **Teste do troca-nome:** se trocar TriboCRM por HubSpot, AINDA funciona? Se sim → reescrever pra ficar específico
- [ ] **Teste do arquétipo:** soa Pessoa Comum 70% + Herói 30%? Não virou guru / coach / mentor?
- [ ] CTA específico (não "saiba mais", não "comente SIM", não "curta se concorda")

### Legenda

- [ ] Hook na primeira linha (corta antes do "..mais")
- [ ] Linguagem alinhada ao modo de voz do pilar (B1)
- [ ] CTA específico no fim
- [ ] 5-7 hashtags relevantes (`#TriboCRM #MáquinaDeVendas` + 3-5 nicho como `#VendasPME #GestãoComercial #FunilDeVendas`)
- [ ] Sem hashtag genérica clichê (#sucesso #empreendedorismo #motivação)

### Pilar e cadência

- [ ] Peça pertence a um dos pilares ativos (B1 §4) · não é genérica
- [ ] Distribuição da semana respeita os pesos atuais **50/20/20/—/10** (Método/Dor/Bastidor/Prova-suspenso/Manifesto) — não tem 3 carrosséis-método seguidos sem variação de pilar
- [ ] **Zero ficção:** peça não atribui frase, depoimento, nome ou case a pessoa/empresa fictícia (regra dura · 28/04/2026)
- [ ] Horário de publicação alinhado com o recomendado (§2)

---

## 5. Ciclo de revisão mensal

### Quando

Último dia útil de cada mês · sessão de 90-120min.

### Roteiro

#### Análise (45min)

1. Abrir aba "Posts" da planilha · ordenar por Saves/1k · ver o top 5 e o bottom 5
2. Abrir aba "Pilares" · qual pilar puxou? Qual custou volume sem retorno?
3. Cruzar formato × performance: carrossel vence reel? Reel-dor vence reel-bastidor?
4. Olhar horários: qual janela converteu melhor?
5. Ler DMs qualificadas do mês: qual pauta gerou? Que pergunta veio mais vez?

#### Recalibragem (45min)

Pra cada um dos 5 eixos abaixo, decidir: **manter · ajustar · cortar**

| Eixo | Decisão | Critério |
|---|---|---|
| Distribuição por pilar | manter 40/20/15/15/10? | Se um pilar é claro vencedor, aumentar 5pp |
| Cadência semanal | manter 3-2-stories? | Se produção tá apertada, cortar 1 carrossel/sem |
| Pautas por pilar | quais voltam? quais saem? | Voltam top 5 do mês · saem bottom 5 |
| Hooks fracos | reescrever? | Bottom 5 hooks: reescrever ou aposentar |
| Pautas novas | quais entram? | A partir das DMs/comentários: se a audiência perguntou X, vira pauta |

#### Ações (30min)

1. Atualizar [02-pautas-e-calendario.md](./02-pautas-e-calendario.md) com aprendizados (mover hooks vencedores pro topo, aposentar fracos)
2. Reescrever 5-10 hooks que não performaram
3. Adicionar 5-10 pautas novas baseadas em DMs/comentários reais
4. Considerar testar formato novo se algo bater no teto (story-bastidor? carrossel-dor próprio?)
5. Anotar no fim da seção "Mês" da planilha: 3 aprendizados + 1 hipótese pra testar no próximo mês

### Critério de pivô

Se ao fim do **Mês 2** as metas estiverem **menos de 50%** atingidas, fazer revisão profunda em vez de incremental:

- Persona errada? Voltar a B1 §2 e reavaliar
- Pilares errados? Reabrir B1 §4 — mas não mude antes de tentar 60 dias
- Tom errado? Comparar copy publicada com B1 §5 (modos de voz)
- Visual errado? Auditar com B3 §1 (princípios)

---

## 6. Conclusão do plano

Os 5 blocos completam a esteira de comunicação do TriboCRM no Instagram:

| Bloco | Pergunta que responde |
|---|---|
| [B1 — Estratégia](./01-estrategia-canal.md) | POR QUE o canal existe? Pra quem fala? Como mede? |
| [B2 — Pautas](./02-pautas-e-calendario.md) | O QUE publicar nos próximos 90 dias? |
| [B3 — Sistema visual](./03-sistema-visual.md) | COMO cada peça fica visualmente? |
| [B4 — Pipeline](./04-pipeline-automacao.md) | COMO produzir as peças sem virar trabalho manual? |
| [B5 — Operação](./05-operacao-medicao.md) | COMO rodar isso semana após semana e saber se tá funcionando? |

### Próximos passos sugeridos (fora do escopo dos blocos)

Quando o plano rodar por 60-90 dias, naturalmente surgem extensões:

1. **Conteúdo em vídeo curto** (TikTok / Shorts) — repurpose dos reels com cortes próprios
2. **Newsletter** — captura de email pra construir lista própria, menos dependente do algoritmo
3. **Mídia paga** — depois de identificar 3-5 peças vencedoras orgânicas, escalar com Meta Ads (Bloco 6 hipotético)
4. **LinkedIn paralelo** — adaptar pilares Método e Bastidor pra audiência B2B mais formal (Prova entra quando reativar)
5. **Podcast / vídeos longos** — se um pilar (Bastidor ou Manifesto) bombar, considera formato longo

---

## 7. Referência rápida — atalhos do plano

| Pra... | Vai em |
|---|---|
| Lembrar dos 5 pilares e pesos | [B1 §4](./01-estrategia-canal.md#4-os-5-pilares-de-conteúdo) |
| Pegar hook pronto pra escrever | [B2 §1](./02-pautas-e-calendario.md#1-banco-de-hooks-por-pilar) |
| Saber estrutura de carrossel | [B2 §2](./02-pautas-e-calendario.md#2-estruturas-padrão-de-copy-por-formato) |
| Ver pauta da próxima semana | [B2 §3](./02-pautas-e-calendario.md#3-calendário-mês-1) |
| Editar template visual | [marketing/instagram/templates/](../../marketing/instagram/templates/) |
| Ajustar tokens (cor/tipo) | [marketing/instagram/tokens.css](../../marketing/instagram/tokens.css) |
| Renderizar uma peça | `cd marketing/instagram && npm run post -- --pauta posts/<arq>.yaml` |
| Renderizar a semana toda | `npm run posts:all` |
| Checklist antes de publicar | [§4 deste bloco](#4-checklist-de-publicação) |

---

## ✅ Checklist de aprovação

- [ ] Workflow semanal (5-6h focadas + 15min/dia) é executável no momento atual?
- [ ] Recomendação Metricool faz sentido — ou prefere testar Postgrain primeiro?
- [ ] Estrutura da planilha de KPI (4 abas) cobre o que precisa medir?
- [ ] Checklist de publicação é completo o bastante pra evitar erros?
- [ ] Ciclo de revisão mensal (90-120min, último dia útil) cabe na agenda?
- [ ] Critério de pivô em M2 (<50% das metas) é razoável?

> Esse era o último bloco. Aprovação fecha o plano completo. A partir daqui é execução.
