# 🎉 Ben faz 5! — Checklist Toy Story

Página para organizar o aniversário de 5 anos do Ben: checklist por etapas, valores previstos e pagos, orçamento, convidados e contagem regressiva. Feita para funcionar no celular e no computador, com dados salvos no navegador e sincronização opcional via GitHub.

## O que tem

- **Checklist por etapas** — planejamento, local, decoração, convidados, comida, look do Ben, lembrancinhas, atividades e o dia da festa.
- **Status por item** — a fazer, em andamento, contratado e concluído, com checkbox para marcar rápido.
- **Valores** — custo previsto, valor já pago, fornecedor, link, data limite e observações.
- **Orçamento** — total, previsto, contratado, pago, a pagar e saldo; gráfico de gastos por etapa e tabela completa.
- **Convidados** — lista com criança/adulto, confirmação de presença e resumo.
- **Contagem regressiva** para a festa.
- **Salvamento automático** no navegador (localStorage).
- **Sincronização opcional com GitHub** para abrir em qualquer aparelho e ver os mesmos dados.
- **Exportar/importar JSON** para backup e **impressão** (útil para gerar um PDF).

Os itens, valores e convidados que aparecem na primeira abertura são **exemplos** — edite ou apague tudo em **Ajustes → Dados**.

## Usar agora

Basta abrir o `index.html` no navegador. Para publicar online, siga o passo a passo abaixo.

## Publicar no GitHub Pages (grátis)

1. Crie um repositório no GitHub, por exemplo `festa-ben` (pode ser público).
2. Envie estes arquivos para a branch `main`:
   - `index.html`
   - `assets/styles.css`
   - `assets/app.js`
   - `README.md`
   - `.nojekyll`
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
4. Clique em **Salvar ajustes**.

Na primeira configuração, a página **não envia nada automaticamente**. Use:

- **☁️ Salvar na nuvem** — envia o que está neste aparelho para o GitHub (cria o `data.json`).
- **⬇️ Carregar** — traz o que já está no GitHub para este aparelho.

> Se você já usa a página em outro aparelho, use **Carregar** primeiro. Se está começando agora, use **Salvar na nuvem** primeiro.

Depois da primeira sincronização, o salvamento automático funciona normalmente. Se aparecer erro de conflito, use **Carregar** e depois salve de novo.

### Segurança e privacidade

- O token não vai para o repositório nem para o `data.json`; ele fica no `localStorage` do navegador.
- Se o repositório for público, a página **e o `data.json`** também são públicos. Não coloque ali dados sensíveis (endereço completo, telefone, CPF etc.). Nomes de convidados já ficam visíveis.
- Para manter tudo privado: use um repositório privado com GitHub Pro/Enterprise para Pages, ou rode a página localmente (`index.html`) e sincronize só quando quiser.
- Revogue o token em **Settings → Developer settings** se ele vazar.

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
index.html          página única
assets/styles.css   visual (tema Toy Story, responsivo e impressão)
assets/app.js       lógica, dados locais e sincronização GitHub
data.json           criado automaticamente na primeira sincronização
.nojekyll           evita processamento do Jekyll no GitHub Pages
```

## Problemas comuns

| Sintoma | O que fazer |
| --- | --- |
| “Token inválido” | Gere outro token e confira se ele tem **Contents: Read and write** no repositório certo. |
| “Arquivo ainda não existe” ao carregar | Normal na primeira vez. Use **Salvar na nuvem** para criar o `data.json`. |
| Erro de conflito ao salvar | Alguém/algo atualizou o arquivo. Use **Carregar**, confira e salve de novo. |
| Dados diferentes entre celular e computador | Falta sincronizar: **Carregar** no aparelho ou **Salvar** no que está atualizado. |
| Página em branco no GitHub Pages | Confira se o Pages está em **main / (root)** e se os arquivos estão na raiz do repositório. |

Feito com 💙 para a festa do Ben.
