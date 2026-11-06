# 🎉 Ben faz 5! — Checklist Toy Story

Projeto com duas áreas: convite público para os convidados e painel de organização com checklist, orçamento e confirmações. Os dados administrativos devem ser sincronizados em um repositório GitHub privado separado.

## O que tem

- **Checklist por etapas** — planejamento, local, decoração, convidados, comida, look do Ben, lembrancinhas, atividades e o dia da festa.
- **Etapas personalizáveis** — use **✏️ Editar nomes das etapas** no checklist (ou **Editar festa → Nomes das etapas do checklist**); os itens permanecem vinculados à etapa original. O checklist começa expandido.
- **Status por item** — a fazer, em andamento, contratado e concluído, com checkbox para marcar rápido.
- **Valores** — custo previsto, valor já pago, fornecedor, link, data limite e observações.
- **Orçamento** — total, previsto, contratado, pago, a pagar e saldo; gráfico de gastos por etapa e tabela completa.
- **Convidados** — lista com criança/adulto, confirmação de presença, parentesco/apelido opcional (ex.: “Vovô Tito”), WhatsApp, observações e vínculo de cada criança com um ou mais adultos responsáveis. O parentesco aparece na busca e na saudação do convite. A lista vem agrupada em **Adultos** e **Crianças**, sempre em ordem **A–Z**, com filtros e busca por nome; clique no título de cada grupo para recolher ou expandir (a escolha fica salva no aparelho). Convidados com parentesco **Pai** ou **Mãe** aparecem na lista com o selo **Anfitrião**, mas não entram nas contagens, nos limites nem no resumo em PDF. Importação de lista em `.txt`, `.csv` ou `.json`.
- **WhatsApp do convidado** — o telefone é formatado sozinho (`(83) 99999-9999`) e validado ao salvar (DDD + 10 ou 11 dígitos). Em cada convidado com número aparecem dois atalhos: **WhatsApp ↗** (abre a conversa) e **Enviar convite ↗** (abre o WhatsApp com somente o link individual do convite animado).
- **Página de confirmação** — página responsiva acessada pelo link enviado junto ao convite oficial. Mostra um resumo da festa e leva o convidado diretamente à busca do nome e aos botões **Vou comemorar** / **Não poderei ir**, com recado opcional. A página respeita a preferência do aparelho por menos movimento e não mostra a lista completa: os nomes aparecem só depois de digitar 3 letras (ou use somente links individuais). Adultos veem as crianças vinculadas para confirmar junto. A resposta cai direto na lista de convidados e, ao confirmar, estrelas sobem pela tela em comemoração.
- **Convite oficial animado** — experiência separada em `convite-animado.html`, com identidade **Ben Story**, personagens, envelope animado, sugestões de presente e música iniciada assim que o navegador permite (a abertura do Buzz já tenta sair com som e a música entra em seguida). O recado do Ben fica acima da trilha, que abaixa durante a fala e volta ao terminar. Os dados públicos do evento vêm de `event.json`; lista, telefones e orçamento não são carregados pelo convite.
- **Aba Convite** — em **💌 Convite** você ajusta nome, idade, data, horário, local, link do mapa, URL do Apps Script e o modo de busca, com prévia do convite. A mesma aba permite editar os textos da abertura, das cenas, do recado do Ben, dos presentes e da página de confirmação, além das sugestões de presente. O botão **🚀 Publicar convite** grava o `event.json` no repositório público do GitHub Pages, sem depender de editar arquivos à mão. A mesma aba reúne os links do **convite animado** e da **página de confirmação**, com botões para abrir e copiar (inclusive copiar somente o link do convite animado para o WhatsApp). As alterações aparecem no topo da organização, no convite animado e na confirmação depois de salvar na nuvem.
- **Limite de convidados** — os cards de **Adultos** e **Crianças** mostram a ocupação do limite: verde até 75%, amarelo de 76% a 95% e vermelho acima de 95%. O card **Confirmados** mostra o percentual de presença confirmada em verde. Os totais padrão são **50 adultos** e **25 crianças**, ajustáveis em **Editar festa → Limite de convidados**.
- **Resumo em PDF** — em **💰 Orçamento → 📄 Exportar resumo PDF**, abra a impressão e escolha **Salvar como PDF** para gerar um relatório com dados da festa, resumo financeiro, itens do checklist/orçamento e convidados separados por adultos e crianças.
- **PDF dos confirmados** — em **🎟️ Convidados → 📄 PDF dos confirmados**, abra a impressão e escolha **Salvar como PDF** para gerar uma lista limpa só com quem confirmou presença, além dos dados da festa e dos contatos dos pais.
- **Olho dos valores** — o botão **👁️ Valores** no topo esconde (desfoca) todos os valores da página com um clique; a escolha fica salva no aparelho. Na aba **Convidados** os valores nem aparecem: ela é só para configurações e informações da lista.
- **Contagem regressiva** para a festa.
- **Salvamento automático** no navegador (localStorage).
- **Sincronização com repositório GitHub privado separado** para abrir o painel em qualquer aparelho sem publicar dados pessoais.
- **Status da sincronização** — aparece em destaque logo abaixo da contagem regressiva, com ações para carregar e salvar na nuvem.
- **Proteção e recuperação** — backup JSON completo acessível no topo, importação para outro aparelho, verificação de integridade e até 3 cópias locais automáticas antes de carregar, importar ou apagar dados.
- **Modo dia da festa** — visão simplificada para celular com prioridades, confirmações, tarefas marcáveis, contatos dos pais, mapa e saldos de fornecedores.
- **Buzz, assistente do Ben** — botão de chat no painel para perguntar e pedir ações em português, sem custo e sem enviar dados para fora do aparelho.

Uma primeira abertura sem configuração começa vazia, evitando que dados demonstrativos sejam confundidos com informações reais.

## Assistente Buzz (local)

O botão **Buzz** aparece no canto inferior direito apenas do painel (`painel.html`), nunca no convite público. Ele conversa em português, consulta os dados reais do painel e executa ações simples usando as mesmas regras e validações da interface. Não usa chave de API nem serviços externos: todo o processamento acontece no navegador.

Exemplos do que ele entende:

- **Consultas:** “quantos confirmados?”, “quem ainda não confirmou?”, “qual o saldo?”, “o que falta no checklist?”, “quais os subitens do bolo?”, “quando é a festa?”
- **Convidados:** “adicionar convidado João”, “adicionar criança Lia, filha de João”, “marcar João como confirmado”, “marcar Lia como não vai”.
- **Checklist:** “criar item bolo na etapa comida”, “adicionar subitem separar caixas em bolo”, “marcar bolo como feito”, “marcar subitem separar caixas como feito”.
- **Orçamento:** “mudar orçamento para 8.000”, “quanto já pagamos?”, “maiores gastos”.
- **Navegação e nuvem:** “abrir convidados”, “salvar na nuvem”, “baixar da nuvem”, “atualizar respostas”.

Ações destrutivas (excluir convidados ou itens) pedem confirmação antes de executar. As demais alterações mostram **Desfazer**, que reverte a última ação do Buzz. O assistente não lê nem altera nada fora deste navegador; quando a nuvem está configurada, as mudanças entram no próximo salvamento como qualquer outra edição do painel.

## Usar agora

- Convite público: `index.html` (encaminha para `convite-animado.html`).
- Painel administrativo: `painel.html`.

## Publicar no GitHub Pages (grátis)

1. Crie um repositório no GitHub, por exemplo `festa-ben` (pode ser público).
2. Envie estes arquivos para a branch `main`:
   - `index.html`, `painel.html`, `convite.html`, `convite-animado.html`, `event.json`
   - `assets/styles.css`, `assets/app.js`, `assets/assistente.js`, `assets/convite.js`, `assets/convite-dados.js`, `assets/convite-animado.css`, `assets/convite-animado.js`, `assets/guest-id.js`
   - `README.md`, `.nojekyll`
3. No repositório, abra **Settings → Pages**.
4. Em **Build and deployment**, escolha **Deploy from a branch**.
5. Selecione a branch **main** e a pasta **/ (root)**. Salve.
6. Em alguns minutos a página estará em:

   `https://SEU-USUARIO.github.io/festa-ben/`

   Abra esse endereço no celular e adicione à tela inicial (no iPhone: Compartilhar → Adicionar à Tela de Início; no Android: menu → Adicionar à tela inicial).

> Sem o passo de sincronização abaixo, cada aparelho guarda os próprios dados. Para ter os mesmos dados em todos, configure o GitHub.

## Sincronizar os dados em repositório privado

O painel usa a API do GitHub para ler e gravar `data.json` em um segundo repositório, obrigatoriamente **privado**. O site público e os dados privados não devem compartilhar o mesmo repositório.

### 1. Crie um token fine-grained

1. No GitHub, acesse **Settings → Developer settings → Personal access tokens → Fine-grained tokens** (atalho: <https://github.com/settings/tokens?type=beta>). Atenção: é nas configurações da **sua conta** (menu do avatar, canto superior direito), não nas configurações do repositório.
2. Clique em **Generate new token**.
3. Crie um repositório privado chamado `festa-ben-dados` e, em **Repository access**, marque somente ele.
4. Em **Permissions → Repository permissions**, dê **Read and write** para **Contents**. Nada mais é necessário.
5. Gere o token e copie o valor (`github_pat_...`).

### 2. Configure na página

1. Abra a página e clique em **☁️ Ativar nuvem** (ou **✏️ Editar festa**).
2. Preencha:
   - **Usuário / organização**: seu usuário do GitHub
   - **Repositório**: `festa-ben-dados`
   - **Branch**: `main`
   - **Arquivo de dados**: `data.json`
   - **Token**: o token criado acima
3. Marque **Salvar automaticamente na nuvem** se quiser que cada alteração seja enviada sozinha (recomendado depois da primeira sincronização).
4. Clique em **Salvar**. A página pergunta se você quer enviar os dados deste aparelho agora — responda **OK** para criar o `data.json`.

Na primeira configuração, a página **não envia nada automaticamente**. Use:

- **☁️ Salvar na nuvem** (na barra do checklist) ou **☁️ Enviar para a nuvem** (dentro de Editar festa) — envia o que está neste aparelho para o GitHub (cria o `data.json`).
- **⬇️ Carregar** — traz o que já está no GitHub para este aparelho.

> Se você já usa a página em outro aparelho, use **Carregar** primeiro. Se está começando agora, use **Salvar na nuvem** primeiro.

Depois da primeira sincronização, o salvamento automático funciona normalmente. Se aparecer erro de conflito, use **Carregar** e depois salve de novo.

### Segurança e privacidade

- O token não vai para o repositório nem para o `data.json`; ele fica no `localStorage` do navegador.
- O painel recusa salvar dados privados em repositório público.
- O site público recebe apenas `event.json`, sem convidados, telefones, recados ou orçamento.
- O token opcional de publicação do convite também fica só no `localStorage`; ele precisa de permissão **Contents: read & write** no repositório público.
- Revogue o token em **Settings → Developer settings** se ele vazar.

## Importar a lista de convidados

Na aba **🎟️ Convidados**, clique em **📂 Importar arquivo** e escolha uma lista `.txt`, `.csv` ou `.json`. A lista não acompanha mais os arquivos públicos do site.

- **Adicionar aos convidados atuais** — mantém a lista e inclui só os nomes novos (repetidos são ignorados).
- **Substituir a lista atual** — apaga os convidados deste aparelho e usa exatamente os do arquivo.

Repetidos são comparados por **nome + tipo**, então uma criança e um adulto com o mesmo nome podem coexistir. Todos entram como **Pendente**, a menos que o arquivo traga o status.

Para usar outro arquivo (ou uma lista atualizada), clique em **📂 Importar arquivo** e escolha o `.txt`, `.csv` ou `.json` do seu aparelho.

### Formatos aceitos

**Texto (`.txt`)** — um nome por linha. Linhas numeradas (`1. Maria`) são aceitas, e títulos de seção definem o tipo:

```
Lista de adultos

Célia Rejane
Elisabete
...

Crianças para o aniversário de Ben

Letícia
Larissa
...
```

Asteriscos no fim do nome são ignorados. Sem seção, todos entram como adultos.

**CSV (`.csv`)** — separado por `;` ou tabulação, com ou sem cabeçalho:

```
Nome;Tipo;Status
Maria;adulto;confirmado
Pedro;criança;pendente
```

**JSON (`.json`)** — uma lista de nomes ou de objetos, ou o backup completo do app:

```json
{
  "guests": [
    { "name": "Maria", "type": "adult", "status": "confirmed" },
    { "name": "Pedro", "type": "child", "status": "pending" }
  ]
}
```

Tipos aceitos: `adulto`/`adult`, `criança`/`child`. Status: `pendente`, `confirmado`, `não vai`.

O arquivo `convidados.json` na raiz já contém a lista atual (69 pessoas: 50 adultos e 19 crianças), pronto para importar em qualquer aparelho. Depois de importar, use **✏️** em cada convidado para completar WhatsApp, observações e vínculos de responsáveis, e então **☁️ Salvar na nuvem** para levar a lista aos outros aparelhos.

## Convite digital e confirmação de presença (RSVP)

O convite oficial fica em **`convite-animado.html`** (ex.: `https://andersonfabiao.github.io/festa-ben/convite-animado.html`). Esse é o link indicado para compartilhar pelo WhatsApp. Depois da animação, o botão **Confirmar presença** abre **`convite.html`**, que mostra a data, a hora e o local e permite ao convidado confirmar ou recusar com um recado opcional.

O link também inclui título, descrição e uma imagem horizontal própria (`assets/convite-ben-5-preview.png`) para a prévia do WhatsApp e de outras redes. Depois de publicar uma nova versão, o WhatsApp pode manter a imagem anterior em cache por algum tempo.

### Local com link para o Google Maps

O local da festa está definido como **Enjoy Kids**, dentro do **Liv Mall Shopping**, na Av. Gov. Flávio Ribeiro Coutinho, 500 - Jardim Oceania, João Pessoa - PB, 58037-005. O chip de localização abre o Google Maps com esse endereço. Se você tiver um link exato do local, cole em **✏️ Editar festa → Link do Google Maps (opcional)** — ele tem prioridade sobre a busca automática e também aparece no convite.

### Editar convidados e vincular crianças

Na aba **🎟️ Convidados**, clique no **✏️** ao lado de qualquer nome para abrir a edição. Ali você pode:

- corrigir o nome e o tipo (criança/adulto);
- preencher **WhatsApp** e **observações**;
- mudar a confirmação manualmente;
- **vincular uma criança a um ou mais adultos** (na criança, marque os responsáveis) ou marcar, no adulto, quais crianças ele leva;
- copiar o **link individual** do convite.

O vínculo é feito nos dois sentidos: marcar um adulto na criança também faz a criança aparecer na lista daquele adulto. Ao abrir o convite, o adulto vê as crianças vinculadas e pode confirmar a presença de cada uma junto com a dele.

> ⚠️ O WhatsApp e as observações ficam salvos no `data.json` do repositório **privado** `festa-ben-dados`, acessado pelo painel por meio de um token. O site público não serve esse arquivo nem os telefones dos convidados — o Apps Script devolve apenas o necessário para cada confirmação. Mesmo assim, evite colocar no campo de observações algo que você não gostaria de registrar.
>
> A tela do convite nunca mostra a lista completa: a busca libera no máximo 12 nomes depois de 3 letras, ou use somente links individuais.

### Links do convite

- **Link único (para o grupo)** — o convidado abre o convite e digita pelo menos 3 letras do nome; só então aparecem as opções (no máximo 12). A lista completa nunca é exibida. O link fica em **Editar festa → Convite e RSVP** e pode ser aberto ou copiado na aba **💌 Convite**.
- **Link individual** — cada convidado tem um link próprio, que já abre o convite com o nome dele. Clique no **🔗** ao lado do nome na lista para copiar. O link usa um ID estável salvo no convidado, então **continua o mesmo mesmo se o nome for alterado**.
- **Modo somente links** — em **Editar festa → Convite e RSVP → Como o convidado encontra o nome**, escolha **Somente link individual**. O convite deixa de ter busca e pede o link pessoal, sem expor nenhum nome. Ideal para grupos menores ou quando a privacidade for prioridade.

O botão **Enviar convite ↗** de cada convidado abre o WhatsApp com somente o link individual do convite animado — sem texto adicional — para você escrever a mensagem do jeito que preferir. O mesmo link pode ser copiado pelo ícone **🔗** na lista.

### Como o convidado responde

1. Abre o link e digita 3 letras do nome (ou já cai no nome, se for link individual).
2. Escreve um recado, se quiser.
3. Se for adulto responsável, escolhe a presença de cada criança vinculada.
4. Toca em **🎉 Vou comemorar** ou **😢 Não poderei ir**.
5. A resposta (e a das crianças) é gravada no `data.json` **privado** e aparece na lista dos anfitriões com status, hora e recado.

No app, a lista se atualiza sozinha a cada minuto (e ao voltar para a aba). Também dá para forçar com **🔄 Atualizar respostas**. Ao salvar na nuvem, o app preserva as respostas que chegaram pelo convite e ainda não estavam no aparelho.

### Configurar o Apps Script (uma vez)

O convite envia a busca e a resposta para um **Google Apps Script**, que acessa o repositório privado usando um token guardado no Google. O passo a passo completo está em **[`apps-script/README.md`](apps-script/README.md)**. Resumo:

1. Crie o script em [script.google.com](https://script.google.com) e cole o conteúdo de `apps-script/rsvp.gs`.
2. Crie `festa-ben-dados` como repositório privado e um token fine-grained com **Contents: Read and write** somente nele.
3. Nas **Propriedades do script**, defina `GH_TOKEN`, `GH_OWNER`, `GH_REPO` (e, se quiser, `GH_BRANCH` e `GH_PATH`).
4. **Implantar → Nova implantação → Aplicativo da Web**, executar como **Eu** e acesso **Qualquer pessoa**.
5. Copie a URL `/exec`, cole em **Editar festa → Convite e RSVP → URL do Google Apps Script**, clique em **Salvar** e depois em **☁️ Salvar na nuvem**.
6. Teste `SUA_URL/exec?ping=1` no navegador: deve responder `{"ok":true,…}`.

Sem essa URL, o convite abre normalmente, mas os botões ficam desativados e aparece um aviso para falar com os anfitriões.

### Antes de compartilhar

1. Importe o backup/lista no painel e clique em **☁️ Salvar na nuvem** para criar o arquivo privado.
2. Configure a URL do Apps Script e salve na nuvem.
3. Abra o link do convite no celular e envie uma resposta de teste.
4. Confira em **🎟️ Convidados → 🔄 Atualizar respostas**.

> Antes de remover o `data.json` do repositório público, confirme que o painel e o Apps Script já apontam para `festa-ben-dados` e que o teste `?ping=1` funciona.

## Backup e impressão

- **Editar festa → Exportar JSON** baixa um arquivo com todos os dados.
- **Editar festa → Importar JSON** restaura um backup (substitui os dados do aparelho).
- **Ctrl/Cmd + P** abre a impressão; o layout é limpo, sem botões, bom para salvar em PDF.

## Personalizar

- **Etapas e itens de exemplo**: `assets/app.js`, constante `STAGES` e função `seedItems`.
- **Cores e fontes**: `assets/styles.css`, variáveis no topo (`:root`).
- **Dados iniciais**: `defaultMeta()` em `assets/app.js` (nome, idade, data, local e orçamento).
- **Textos do painel**: `painel.html`.
- **Textos e presentes do convite**: aba **💌 Convite** do painel. Os valores padrão ficam em `INVITE_COPY_DEFAULTS` (`assets/app.js`), `assets/convite-dados.js` e `FALLBACK_INVITE` (`assets/convite.js`).

## Estrutura

```
index.html            entrada pública que abre o convite animado
painel.html           painel administrativo (checklist, orçamento e convidados)
convite-animado.html  convite oficial animado para compartilhar pelo WhatsApp
convite.html          página de confirmação de presença
event.json            somente dados públicos do evento
assets/styles.css     visual (tema Toy Story, responsivo, impressão e convite)
assets/convite-animado.css visual e animações do convite oficial
assets/app.js         lógica, dados locais e sincronização GitHub
assets/guest-id.js    ID estável do convidado (usado pelo app e pelo convite)
assets/convite.js     carrega o convite e envia a resposta ao Apps Script
assets/convite-dados.js atualiza nome, idade, data, hora e local do convite animado
assets/convite-animado.js controla cenas, áudio e repetição do convite
apps-script/rsvp.gs   script do Google que grava a resposta no data.json
apps-script/README.md passo a passo do Apps Script
data.json             arquivo privado; existe no repositório de dados, não no site final
lista_convidados.txt  mesma lista em texto simples
.nojekyll             evita processamento do Jekyll no GitHub Pages
```

## Problemas comuns

| Sintoma | O que fazer |
| --- | --- |
| “Token inválido” | Gere outro token e confira se ele tem **Contents: Read and write** no repositório certo. |
| “Arquivo ainda não existe” ao carregar | Normal na primeira vez. Use **Enviar para a nuvem** (em Editar festa) ou **Salvar na nuvem** para criar o `data.json`. Se você já salvou em outro aparelho, confira o token (**Contents: Read and write**) e se o branch é o mesmo. |
| Erro de conflito ao salvar | Alguém/algo atualizou o arquivo. Use **Carregar**, confira e salve de novo. |
| Dados diferentes entre celular e computador | Falta sincronizar: **Carregar** no aparelho ou **Salvar** no que está atualizado. |
| Botões do convite desativados | Falta configurar a URL do Apps Script em **Editar festa → Convite e RSVP** e clicar em **Salvar**. |
| Resposta do convite não aparece | Clique em **🔄 Atualizar respostas**. Se persistir, teste `SUA_URL/exec?ping=1` e veja [`apps-script/README.md`](apps-script/README.md). |
| Convite diz "não encontrei esse convite" | O convite foi removido da lista ou o `data.json` ainda não foi atualizado | Importe/edite a lista, clique em **☁️ Salvar na nuvem** e copie o link novo pelo **🔗**. |
| Página em branco no GitHub Pages | Confira se o Pages está em **main / (root)** e se os arquivos estão na raiz do repositório. |

Feito com 💙 para a festa do Ben.
