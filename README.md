# Tales of Fantasy — servidor multiplayer inicial

Este pacote cria a primeira versão do servidor WebSocket para até **10 jogadores simultâneos**.

## O que já funciona nesta etapa

- Conexão WebSocket compatível com o módulo `Net` que já existe no HTML do jogo.
- Entrada e saída de jogadores, com atualização dos personagens na tela.
- Sincronização da posição e direção dos jogadores.
- Chat compartilhado.
- Endpoint HTTP `/health` para verificar se o servidor está ativo.
- Limite de 10 jogadores e controles básicos contra mensagens excessivas.

## O que ainda NÃO está sincronizado

Monstros, dano, ataques, coleta, inventário, profissões, experiência, moedas e salvamento continuam locais no navegador. O servidor ainda não autentica contas nem grava progresso em banco de dados. Não anuncie esta versão como multiplayer completo.

## Testar no computador

1. Instale Node.js 20 ou superior: https://nodejs.org/
2. Extraia esta pasta.
3. Abra um terminal dentro da pasta `tof-multiplayer-server`.
4. Execute `npm install`.
5. Execute `npm start`.
6. O servidor ficará em `http://localhost:3000` e aceitará WebSocket em `ws://localhost:3000`.

Para conectar o jogo no mesmo computador, abra o HTML e altere a linha:

```js
const SERVER_URL='';
```

para:

```js
const SERVER_URL='ws://localhost:3000';
```

Salve como uma cópia separada, sem apagar o HTML original. Abra essa cópia em duas janelas/navegadores para testar dois personagens.

## Publicar no Render

1. Crie um repositório GitHub e envie os arquivos desta pasta para ele.
2. No Render, crie um **New Web Service** e conecte esse repositório.
3. Use `npm install` como Build Command e `npm start` como Start Command.
4. Não fixe a porta: o servidor usa a variável `PORT` fornecida pela hospedagem.
5. Depois do deploy, teste `https://SEU-SERVICO.onrender.com/health`.
6. No HTML do jogo, configure `SERVER_URL` com o endereço WebSocket seguro: `wss://SEU-SERVICO.onrender.com`.
7. Publique o HTML atualizado em um site HTTPS e teste com duas pessoas em redes diferentes.

**Atenção:** hospedagem gratuita pode colocar o serviço em repouso, reiniciar ou ter limites de uso. É adequada para protótipo/testes, mas não garante disponibilidade 24 horas por dia. Confirme as regras e limites atuais do plano antes de publicar.

## Próximas etapas do projeto

1. Fazer o teste de conexão com 2 jogadores.
2. Ajustar limites do mapa e validar movimento no servidor.
3. Mover combate e vida para o servidor (servidor autoritativo).
4. Sincronizar monstros, drops e coleta.
5. Criar autenticação e salvamento seguro em banco de dados.
6. Testar carga e estabilidade com até 10 jogadores.
