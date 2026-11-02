# Confirmação de presença (RSVP) — Google Apps Script

A página do convite (`convite.html`) é pública, mas a lista de convidados não precisa ser. O Google Apps Script consulta e grava as respostas em um **repositório privado separado**. O token fica guardado no Google e nunca é enviado ao convidado.

Fluxo:

```
Convidado → convite.html → Apps Script → repositório privado → data.json
                                      ↑
                         token fica nas Propriedades do script
```

## 1. Criar o script

1. Abra [script.google.com](https://script.google.com) e clique em **Novo projeto**.
2. Apague o conteúdo de `Code.gs`.
3. Abra o arquivo [`rsvp.gs`](rsvp.gs) deste repositório, copie tudo e cole no editor.
4. Renomeie o projeto para algo como `RSVP Ben 5`.

## 2. Criar o repositório privado e o token

1. No GitHub, crie um novo repositório chamado `festa-ben-dados` e marque-o como **Private**.
2. Não ative GitHub Pages nesse repositório.

Depois crie um token **fine-grained** dedicado:

1. Abra [github.com/settings/tokens?type=beta](https://github.com/settings/tokens?type=beta).
2. **Generate new token**.
3. Em **Repository access**, escolha **Only select repositories** e marque apenas `festa-ben-dados`.
4. Em **Permissions → Repository permissions**, coloque **Contents** em **Read and write**.
5. Gere, copie o valor (`github_pat_…`) e guarde.

## 3. Configurar as Propriedades do script

No Apps Script, abra **Configurações do projeto** (ícone de engrenagem) → **Propriedades do script** → **Adicionar propriedade** e crie:

| Propriedade | Valor |
| --- | --- |
| `GH_TOKEN` | o token `github_pat_…` criado no passo 2 |
| `GH_OWNER` | `andersonfabiao` |
| `GH_REPO` | `festa-ben-dados` |
| `GH_BRANCH` | `main` (opcional — este é o padrão) |
| `GH_PATH` | `data.json` (opcional — este é o padrão) |

Clique em **Salvar propriedades do script**.

## 4. Publicar como aplicativo da Web

1. Clique em **Implantar** → **Nova implantação**.
2. Em **Selecionar tipo**, escolha **Aplicativo da Web**.
3. Em **Executar como**, escolha **Eu** (sua conta).
4. Em **Quem tem acesso**, escolha **Qualquer pessoa**.
5. Clique em **Implantar** e autorize o acesso (o Google mostra um aviso; é o seu próprio script pedindo permissão para acessar a internet).
6. Copie a **URL do aplicativo da Web**, que termina em `/exec`.

> Toda vez que alterar o `rsvp.gs`, publique de novo: **Implantar → Gerenciar implantações → editar (lápis) → Versão: Nova versão → Implantar**. A URL continua a mesma.

## 5. Testar

Abra no navegador:

```
SUA_URL/exec?ping=1
```

Deve aparecer algo assim:

```json
{"ok":true,"service":"rsvp-ben","repo":"andersonfabiao/festa-ben-dados","branch":"main","path":"data.json","guests":70}
```

Se aparecer `"ok":false`, a mensagem de erro indica o que falta (token, repositório, caminho etc.).

## 6. Ligar o convite ao script

1. Abra o site da festa e vá em **⚙️ Ajustes**.
2. No campo **URL do Google Apps Script**, cole a URL `/exec`.
3. Clique em **Salvar**.
4. Configure também o mesmo repositório privado na seção **Sincronização privada com GitHub**.
5. Clique em **☁️ Salvar na nuvem** para criar o `data.json` privado.

A partir daí, o convite mostra os botões **🎉 Vou comemorar** e **😢 Não poderei ir** habilitados.

## 7. Conferir a resposta

1. Abra o convite, digite 3 letras do nome (ou use o link individual), responda e deixe um recado.
2. Se for um adulto com crianças vinculadas, ajuste a presença de cada criança antes de enviar.
3. No site, aba **🎟️ Convidados**, clique em **🔄 Atualizar respostas** (ou recarregue a página).
4. O status, a hora e o recado do convidado — e o status das crianças — devem aparecer na lista.

## Como funciona por dentro

- `doGet(?ping=1)` testa o acesso ao arquivo privado e devolve somente a quantidade de convidados.
- `doGet(?action=lookup&q=ana)` pesquisa no servidor e devolve no máximo 12 resultados, sem telefone, observações, orçamento ou recados.
- `doGet(?action=lookup&id=...)` abre o convite individual e devolve somente o convidado e os familiares vinculados.
- `doPost` recebe `{ id, name, type, status, message, children }`, valida o status (`confirmed`/`declined`), encontra o convidado pelo ID estável e grava `status`, `rsvpAt`, `rsvpMessage` e `rsvpSource: "guest"`. Se vierem `children: [{ id, status }]`, atualiza também as crianças **vinculadas a esse adulto** na mesma gravação.
- Para um nome ausente da lista, `doPost` também aceita `{ action: "unlisted-rsvp", name }`, cria um adulto confirmado com `unlisted: true` e o identifica no painel como novo convidado.
- O ID do convidado fica salvo no próprio convidado (gerado por `assets/guest-id.js` na primeira criação). Renomear não muda o ID nem o link individual.
- Usa `LockService` para evitar duas gravações simultâneas e tenta de novo em caso de conflito (`409`/`422`).
- O site também tenta de novo em modo `no-cors` quando o navegador bloqueia a leitura da resposta; nesse caso a confirmação pode levar alguns segundos para aparecer na lista dos anfitriões.

## Problemas comuns

| Sintoma | Causa provável | Solução |
| --- | --- | --- |
| `Configuração incompleta: falta GH_TOKEN…` | Propriedade não criada ou com nome errado | Confira as Propriedades do script (maiúsculas e sublinhado). |
| `GitHub recusou a leitura (401)` | Token inválido, expirado ou sem permissão | Gere outro token com **Contents: Read and write**. |
| `GitHub recusou a leitura (404)` | Dono/repositório/caminho errados | Confira `GH_OWNER`, `GH_REPO` e `GH_PATH`. |
| `O repositório de dados precisa ser privado` | O script ainda aponta para o site público | Crie `festa-ben-dados` como privado e atualize `GH_REPO`. |
| `Convidado não encontrado` | Nome alterado ou lista ainda não enviada à nuvem | Importe a lista no app e clique em **☁️ Salvar na nuvem**. |
| Botões desativados no convite | URL do Apps Script não configurada | Cole a URL em **Ajustes** e clique em **Salvar** + **☁️ Salvar na nuvem**. |
| Resposta não aparece | Ainda não atualizou / link antigo | Clique em **🔄 Atualizar respostas**; confira se o convite usou o link novo. |

## Segurança

- O token fica **somente** nas Propriedades do script do Google e no navegador do administrador; use um token dedicado, limitado ao repositório privado.
- O script recusa repositórios públicos.
- A busca pública nunca devolve a lista completa nem campos privados.
- O endpoint aceita respostas de quem localizar o nome ou receber o link individual; ele não expõe o token e só altera status e recado do convidado escolhido.
