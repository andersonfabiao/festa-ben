# 🎉 Ben faz 5! — Checklist Toy Story

Página para organizar o aniversário de 5 anos do Ben: checklist por etapas, valores previstos e pagos, orçamento, convidados e contagem regressiva. Feita para funcionar no celular e no computador, com dados salvos no navegador e sincronização opcional via GitHub.

## O que tem

- **Checklist por etapas** — planejamento, local, decoração, convidados, comida, look do Ben, lembrancinhas, atividades e o dia da festa.
- **Etapas personalizáveis** — renomeie as etapas em **Ajustes → Nomes das etapas do checklist**; os itens permanecem vinculados à etapa original.
- **Status por item** — a fazer, em andamento, contratado e concluído, com checkbox para marcar rápido.
- **Valores** — custo previsto, valor já pago, fornecedor, link, data limite e observações.
- **Orçamento** — total, previsto, contratado, pago, a pagar e saldo; gráfico de gastos por etapa e tabela completa.
- **Convidados** — lista com criança/adulto, confirmação de presença, WhatsApp, observações e vínculo de cada criança com um ou mais adultos responsáveis. A lista vem agrupada em **Adultos** e **Crianças**, sempre em ordem **A–Z**, com filtros **Todos / Adultos / Crianças / Confirmados / Pendentes / Não vão** e busca por nome. O botão **＋ Adicionar convidado** abre o mesmo modal de edição, com tipo, confirmação, WhatsApp, observações e vínculos. Importação de lista em `.txt`, `.csv` ou `.json`.
- **Convite digital animado** — página própria e responsiva inspirada no quarto do Andy, com papel de parede de nuvens, madeira, brinquedos e os personagens reunidos. Mostra a data, o local (com link para o **Google Maps**) e os botões **Vou comemorar** / **Não poderei ir**, com recado opcional. O convite respeita a preferência do aparelho por menos movimento e não mostra a lista completa: os nomes aparecem só depois de digitar 3 letras (ou use somente links individuais). Adultos veem as crianças vinculadas para confirmar junto. A resposta cai direto na lista de convidados e, ao confirmar, estrelas sobem pela tela em comemoração.
- **Limite de convidados** — os cards de **Adultos** e **Crianças** mostram a ocupação do limite, com percentual e cor que vai do verde ao vermelho ao chegar no máximo. O card **Confirmados** mostra o percentual de presença confirmada, com progresso verde crescente. Os totais padrão são **50 adultos** e **25 crianças**, ajustáveis em **Ajustes → Limite de convidados**.
- **Resumo em PDF** — em **💰 Orçamento → 📄 Exportar resumo PDF**, abra a impressão e escolha **Salvar como PDF** para gerar um relatório com dados da festa, resumo financeiro, itens do checklist/orçamento e convidados separados por adultos e crianças.
- **Olho dos valores** — o botão **👁️ Valores** no topo esconde (desfoca) todos os valores da página com um clique; a escolha fica salva no aparelho. Na aba **Convidados** os valores nem aparecem: ela é só para configurações e informações da lista.
- **Contagem regressiva** para a festa.
- **Salvamento automático** no navegador (localStorage).
- **Sincronização opcional com GitHub** para abrir em qualquer aparelho e ver os mesmos dados.
- **Status da sincronização** — aparece em destaque logo abaixo da contagem regressiva, com ações para carregar e salvar na nuvem.
- **Exportar/importar JSON** para backup e **impressão** (útil para gerar um PDF).

Os itens, valores e convidados que aparecem na primeira abertura são **exemplos** — edite ou apague tudo em **Ajustes → Dados**.

## Usar agora

Basta abrir o `index.html` no navegador. Para publicar online, siga o passo a passo abaixo.

## Publicar no GitHub Pages (grátis)

1. Crie um repositório no GitHub, por exemplo `festa-ben` (pode ser público).
2. Envie estes arquivos para a branch `main`:
   - `index.html`, `convite.html`
   - `assets/styles.css`, `assets/app.js`, `assets/convite.js`, `assets/guest-id.js`
   - `convidados.json`
   - `README.md`, `.nojekyll`
3. No repositório, abra **Settings → Pages**.
4. Em **Build and deployment**, escolha **Deploy from a branch**.
5. Selecione a branch **main** e a pasta **/ (root)**. Salve.
6. Em alguns minutos a página estará em:

   `https://SEU-USUARIO.github.io/festa-ben/`

   Abra esse endereço no celular e adicione à tela inicial (no iPhone: Compartilhar → Adicionar à Tela de Início; no Android: menu → Adicionar à tela inicial).

> Sem o passo de sincronização abaixo, cada aparelho guarda os próprios dados. Para ter os mesmos dados em todos, configure o GitHub.

## Sincronizar os dados pelo GitHub (opcional)

A página usa a API de conteúdo do GitHub para ler e gravar um arquivo `data.json` no seu repositório. O token fica salvo **somente no navegador** e nunca é enviado para o repositório.

### 1. Crie um token fine-grained

1. No GitHub, acesse **Settings → Developer settings → Personal access tokens → Fine-grained tokens** (atalho: <https://github.com/settings/tokens?type=beta>). Atenção: é nas configurações da **sua conta** (menu do avatar, canto superior direito), não nas configurações do repositório.
2. Clique em **Generate new token**.
3. Em **Repository access**, escolha **Only select repositories** e marque o repositório da festa.
4. Em **Permissions → Repository permissions**, dê **Read and write** para **Contents**. Nada mais é necessário.
5. Gere o token e copie o valor (`github_pat_...`).

### 2. Configure na página

1. Abra a página e clique em **☁️ Ativar nuvem** (ou **⚙️ Ajustes**).
2. Preencha:
   - **Usuário / organização**: seu usuário do GitHub
   - **Repositório**: `festa-ben`
   - **Branch**: `main`
   - **Arquivo de dados**: `data.json`
   - **Token**: o token criado acima
3. Marque **Salvar automaticamente na nuvem** se quiser que cada alteração seja enviada sozinha (recomendado depois da primeira sincronização).
4. Clique em **Salvar ajustes**. A página pergunta se você quer enviar os dados deste aparelho agora — responda **OK** para criar o `data.json`.

Na primeira configuração, a página **não envia nada automaticamente**. Use:

- **☁️ Salvar na nuvem** (na barra do checklist) ou **☁️ Enviar para a nuvem** (dentro de Ajustes) — envia o que está neste aparelho para o GitHub (cria o `data.json`).
- **⬇️ Carregar** — traz o que já está no GitHub para este aparelho.

> Se você já usa a página em outro aparelho, use **Carregar** primeiro. Se está começando agora, use **Salvar na nuvem** primeiro.

Depois da primeira sincronização, o salvamento automático funciona normalmente. Se aparecer erro de conflito, use **Carregar** e depois salve de novo.

### Segurança e privacidade

- O token não vai para o repositório nem para o `data.json`; ele fica no `localStorage` do navegador.
- Se o repositório for público, a página **e o `data.json`** também são públicos. Não coloque ali dados sensíveis (endereço completo, telefone, CPF etc.). Nomes de convidados já ficam visíveis.
- Para manter tudo privado: use um repositório privado com GitHub Pro/Enterprise para Pages, ou rode a página localmente (`index.html`) e sincronize só quando quiser.
- Revogue o token em **Settings → Developer settings** se ele vazar.

## Importar a lista de convidados

Na aba **🎟️ Convidados**, clique em **📥 Lista do Ben (69)** para carregar direto o `convidados.json` publicado no site — não precisa baixar arquivo nenhum. A página mostra um resumo (quantos adultos e quantas crianças) e deixa você escolher:

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

O convite fica em **`convite.html`** (ex.: `https://andersonfabiao.github.io/festa-ben/convite.html`). Ele mostra a data, a hora, o local e o tema, e deixa o convidado confirmar ou recusar com um recado opcional.

O link também inclui título, descrição e uma imagem horizontal própria (`assets/convite-ben-5-preview.png`) para a prévia do WhatsApp e de outras redes. Depois de publicar uma nova versão, o WhatsApp pode manter a imagem anterior em cache por algum tempo.

### Local com link para o Google Maps

O local da festa está definido como **Enjoy Kids**, dentro do **Liv Mall Shopping**, na Av. Gov. Flávio Ribeiro Coutinho, 500 - Jardim Oceania, João Pessoa - PB, 58037-005. O chip de localização abre o Google Maps com esse endereço. Se você tiver um link exato do local, cole em **⚙️ Ajustes → Link do Google Maps (opcional)** — ele tem prioridade sobre a busca automática. O mesmo link aparece no texto do **📋 Copiar convite**.

### Editar convidados e vincular crianças

Na aba **🎟️ Convidados**, clique no **✏️** ao lado de qualquer nome para abrir a edição. Ali você pode:

- corrigir o nome e o tipo (criança/adulto);
- preencher **WhatsApp** e **observações**;
- mudar a confirmação manualmente;
- **vincular uma criança a um ou mais adultos** (na criança, marque os responsáveis) ou marcar, no adulto, quais crianças ele leva;
- copiar o **link individual** do convite.

O vínculo é feito nos dois sentidos: marcar um adulto na criança também faz a criança aparecer na lista daquele adulto. Ao abrir o convite, o adulto vê as crianças vinculadas e pode confirmar a presença de cada uma junto com a dele.

> ⚠️ O WhatsApp e as observações ficam salvos no `data.json`. Se o repositório for público, **esses dados também ficam públicos**. Preencha só o que você não se importa em deixar visível.
>
> A tela do convite não mostra a lista completa, mas o arquivo `data.json` continua público no repositório. Quem abrir esse arquivo consegue ver os nomes. Para esconder de verdade, use um repositório privado e publique o site por outro meio.

### Links do convite

- **Link único (para o grupo)** — o convidado abre o convite e digita pelo menos 3 letras do nome; só então aparecem as opções (no máximo 12). A lista completa nunca é exibida. Use **🔗 Link do convite** na aba **Convidados** ou o campo em **Ajustes → Convite e RSVP**.
- **Link individual** — cada convidado tem um link próprio, que já abre o convite com o nome dele. Clique no **🔗** ao lado do nome na lista para copiar. O link usa um ID estável salvo no convidado, então **continua o mesmo mesmo se o nome for alterado**.
- **Modo somente links** — em **Ajustes → Convite e RSVP → Como o convidado encontra o nome**, escolha **Somente link individual**. O convite deixa de ter busca e pede o link pessoal, sem expor nenhum nome. Ideal para grupos menores ou quando a privacidade for prioridade.

O botão **📋 Copiar convite** copia um texto pronto com data, local e o link único para colar no WhatsApp.

### Como o convidado responde

1. Abre o link e digita 3 letras do nome (ou já cai no nome, se for link individual).
2. Escreve um recado, se quiser.
3. Se for adulto responsável, escolhe a presença de cada criança vinculada.
4. Toca em **🎉 Vou comemorar** ou **😢 Não poderei ir**.
5. A resposta (e a das crianças) é gravada no `data.json` e aparece na lista dos anfitriões com status, hora e recado. Ao confirmar, estrelas sobem pela tela (respeita a opção de reduzir movimento do sistema).

No app, a lista se atualiza sozinha a cada minuto (e ao voltar para a aba). Também dá para forçar com **🔄 Atualizar respostas**. Ao salvar na nuvem, o app preserva as respostas que chegaram pelo convite e ainda não estavam no aparelho.

### Configurar o Apps Script (uma vez)

O GitHub Pages é estático e não pode gravar no repositório com segurança, então o convite envia a resposta para um **Google Apps Script**, que grava no `data.json` usando um token guardado no Google. O passo a passo completo está em **[`apps-script/README.md`](apps-script/README.md)**. Resumo:

1. Crie o script em [script.google.com](https://script.google.com) e cole o conteúdo de `apps-script/rsvp.gs`.
2. Crie um token fine-grained com **Contents: Read and write** no repositório.
3. Nas **Propriedades do script**, defina `GH_TOKEN`, `GH_OWNER`, `GH_REPO` (e, se quiser, `GH_BRANCH` e `GH_PATH`).
4. **Implantar → Nova implantação → Aplicativo da Web**, executar como **Eu** e acesso **Qualquer pessoa**.
5. Copie a URL `/exec`, cole em **Ajustes → Convite e RSVP → URL do Google Apps Script**, clique em **Salvar** e depois em **☁️ Salvar na nuvem**.
6. Teste `SUA_URL/exec?ping=1` no navegador: deve responder `{"ok":true,…}`.

Sem essa URL, o convite abre normalmente, mas os botões ficam desativados e aparece um aviso para falar com os anfitriões.

### Antes de compartilhar

1. Importe a lista (**📥 Lista do Ben (69)**) e clique em **☁️ Salvar na nuvem** — o convite lê o `data.json` publicado.
2. Configure a URL do Apps Script e salve na nuvem.
3. Abra o link do convite no celular e envie uma resposta de teste.
4. Confira em **🎟️ Convidados → 🔄 Atualizar respostas**.

> O repositório é público, então nomes, confirmações, recados, **WhatsApp e observações** no `data.json` também são públicos. O token do GitHub **não** vai para o site: fica só no navegador (app) e nas Propriedades do script (RSVP).

## Backup e impressão

- **Ajustes → Exportar JSON** baixa um arquivo com todos os dados.
- **Ajustes → Importar JSON** restaura um backup (substitui os dados do aparelho).
- **Ctrl/Cmd + P** abre a impressão; o layout é limpo, sem botões, bom para salvar em PDF.

## Personalizar

- **Etapas e itens de exemplo**: `assets/app.js`, constante `STAGES` e função `seedItems`.
- **Cores e fontes**: `assets/styles.css`, variáveis no topo (`:root`).
- **Dados iniciais**: `defaultMeta()` em `assets/app.js` (nome, idade, data, local e orçamento).
- **Textos da página**: `index.html`.

## Estrutura

```
index.html            página principal (checklist, orçamento, convidados)
convite.html          convite digital com confirmação de presença
assets/styles.css     visual (tema Toy Story, responsivo, impressão e convite)
assets/app.js         lógica, dados locais e sincronização GitHub
assets/guest-id.js    ID estável do convidado (usado pelo app e pelo convite)
assets/convite.js     carrega o convite e envia a resposta ao Apps Script
apps-script/rsvp.gs   script do Google que grava a resposta no data.json
apps-script/README.md passo a passo do Apps Script
data.json             criado automaticamente na primeira sincronização
convidados.json       lista de convidados pronta para importar
lista_convidados.txt  mesma lista em texto simples
.nojekyll             evita processamento do Jekyll no GitHub Pages
```

## Problemas comuns

| Sintoma | O que fazer |
| --- | --- |
| “Token inválido” | Gere outro token e confira se ele tem **Contents: Read and write** no repositório certo. |
| “Arquivo ainda não existe” ao carregar | Normal na primeira vez. Use **Enviar para a nuvem** (em Ajustes) ou **Salvar na nuvem** para criar o `data.json`. Se você já salvou em outro aparelho, confira o token (**Contents: Read and write**) e se o branch é o mesmo. |
| Erro de conflito ao salvar | Alguém/algo atualizou o arquivo. Use **Carregar**, confira e salve de novo. |
| Dados diferentes entre celular e computador | Falta sincronizar: **Carregar** no aparelho ou **Salvar** no que está atualizado. |
| Botões do convite desativados | Falta configurar a URL do Apps Script em **Ajustes → Convite e RSVP** e clicar em **Salvar**. |
| Resposta do convite não aparece | Clique em **🔄 Atualizar respostas**. Se persistir, teste `SUA_URL/exec?ping=1` e veja [`apps-script/README.md`](apps-script/README.md). |
| Convite diz "não encontrei esse convite" | O convite foi removido da lista ou o `data.json` ainda não foi atualizado | Importe/edite a lista, clique em **☁️ Salvar na nuvem** e copie o link novo pelo **🔗**. |
| Página em branco no GitHub Pages | Confira se o Pages está em **main / (root)** e se os arquivos estão na raiz do repositório. |

Feito com 💙 para a festa do Ben.
