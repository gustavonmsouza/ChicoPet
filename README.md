# Chico Desktop Companion

Um mascote em pixel art, inspirado no Yorkshire Terrier Chico, que vive na área de trabalho do macOS.

## Tecnologias
Electron 45 · Node.js 22.12+ · HTML/CSS/JavaScript (módulos ES). Sem IA, banco de dados ou voz nesta versão.

## Requisitos
- macOS (Apple Silicon ou Intel)
- Node.js 22.12 ou superior (`node -v`) e npm (`npm -v`)

## Como executar
```bash
npm install
npm start
npm test        # testes unitários (node:test)
npm run test:smoke # inicia o app e valida renderer/IPC no macOS
```

## Como usar
- Arraste o Chico com o botão esquerdo.
- Clique nele: ele fica feliz e fala algo.
- Botão direito (ou ctrl+clique): menu para esconder, trocar de pose (teste) ou sair.
- Ícone na barra de menus: clique mostra/esconde; botão direito abre o menu.
- Menu de contexto: fazer carinho ou brincar com o Chico.
- Preferências: pausar movimento autônomo, escolher ritmo e iniciar com o macOS.

## Estrutura
```
assets/sprites/source/     folhas-fonte originais e folha de referência, preservadas
assets/sprites/normalized/ quadros RGBA gerados para montar a atlas
assets/sprites/chico-spritesheet.png atlas RGBA única usada pelo renderer
assets/icons/              ícones do app e da barra de menus
src/main/appPaths.js        caminhos de assets e código usados pelo processo principal
src/main/                   processo principal: janela, tray, IPC
src/preload/                ponte segura entre a página e o processo principal
src/renderer/               página e módulos de animação, interação e fala
tests/                      testes unitários
tools/                      geradores determinísticos de sprites (Python padrão, sem dependências)
```
Os caminhos e módulos de código seguem os nomes convencionais em inglês; os arquivos de imagem usam nomes em
português, como `caminhada-direita-01.png` e `queda-esquerda-01.png`.

## Como substituir os sprites
As folhas-fonte originais, incluindo as antigas, ficam preservadas em `assets/sprites/source/`. A folha
`reference.png` contém oito poses de caminhada e oito de corrida para a direita, além de poses de repouso,
sentado e dormindo. A caminhada antiga deixou de ser fonte do catálogo; a corrida também passou a usar a sequência
própria da folha de referência. Para reconstruir os arquivos de runtime, execute:

```bash
python3 tools/build_normalized_sprites.py
python3 tools/build_sprite_atlas.py
```

O gerador conserva as fontes, remove o fundo verde da nova folha por chroma key com descontaminação das bordas,
remove os fundos das folhas antigas, alinha os pés ao chão e escreve frames RGBA em um canvas fixo de 640×512.
Ele também usa uma paleta compartilhada para caminhada, corrida, queda e repouso. O tamanho na tela é controlado
por `SPRITE_SCALE` em `src/renderer/scripts/config.js`.
O segundo comando empacota esses quadros em uma atlas de células 640×512; `sprites.js` e `animations.js` identificam
cada frame por coluna e linha, e o renderer altera `background-position` sem trocar a imagem.
As preferências ficam em `preferences.json` dentro do diretório de dados do Electron. O gerador deve ser
reexecutado sempre que seus parâmetros ou as folhas-fonte mudarem.

## Testes e distribuição
`npm test` executa os testes de lógica, persistência de preferências, alinhamento visual dos quadros e
reprodutibilidade do gerador. `npm run test:smoke` valida no macOS a inicialização, os oito quadros de caminhada
em cada direção e a interação IPC; usa um diretório temporário e não altera as preferências reais.

O GitHub Actions roda a suíte em Linux e macOS. Para gerar os pacotes localmente, use `npm run dist:mac`.
Ao enviar uma tag `v*`, o workflow de release cria artefatos DMG e ZIP para Apple Silicon e Intel e publica
uma release no GitHub. Sem os secrets de certificado/notarização configurados, os pacotes são não assinados;
configure `MACOS_CERTIFICATE`, `MACOS_CERTIFICATE_PASSWORD`, `APPLE_ID`,
`APPLE_APP_SPECIFIC_PASSWORD` e `APPLE_TEAM_ID` no repositório para assinatura e notarização.
O comando de distribuição também recria o ícone `.icns` do app a partir do sprite normalizado.
Os pacotes finais incluem somente os ícones e a atlas usados em runtime; as fontes gráficas e os quadros
intermediários continuam no projeto para edição e geração, mas não são copiados para o app distribuído.

## Segurança
`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, CSP restritiva, preload com 5 funções,
IPC validado (origem e tipo), navegação e janelas novas bloqueadas.

## Limitações conhecidas
- O smoke test confirma as sequências de caminhada, o ajuste de cadência, o avanço manual de quadros e o IPC no macOS;
    ele não substitui a validação manual do clique-through, tray, múltiplos monitores e Spaces em máquinas reais.
- Pode não aparecer sobre apps em tela cheia do macOS.
- A área de clique do Chico é o retângulo da imagem (não o contorno exato).
- Mensagens ainda são locais; sem IA.

## Implementado
Janela transparente sem moldura, sempre no topo, arrastar, clicar, balão de fala, estados comportamentais,
movimento autônomo gradual pela área útil do monitor, pausas, sono, curiosidade, corrida curta, reação a cliques,
ocultar/mostrar, tray e reposicionamento ao mudar de monitor. O processo principal é o único controlador da posição;
enquanto o mascote é arrastado, o movimento autônomo fica suspenso e retoma após uma pausa. O Chico fica apoiado na
borda inferior física do monitor, mesmo quando a Dock reduz a área útil; ao soltar no ar, cai com gravidade limitada, aterrissa
e passa por recuperação. Arrastar durante a queda cancela a física. Caminhada e atividades de repouso são restritas ao chão.

## Recursos gráficos e limitações
As poses utilizadas pelo app são geradas em `assets/sprites/normalized/`. Cada quadro tem fundo transparente, canvas de
640×512, linha de chão comum e uma paleta única. O gerador remove o fundo branco/xadrez inclusive nos espaços entre
as patas e limpa a borda neutra deixada pelas folhas-fonte. Isso impede flashes de tamanho, manchas de fundo e trocas
de tom quando uma animação avança.

O catálogo usa oito poses de caminhada e oito de corrida por direção, cinco de queda, aterrissagem, recuperação,
seis poses de repouso, quatro sentado e três dormindo. Caminhada e corrida usam velocidades diferentes. A folha nova
fornece as sequências para a direita; as sequências à esquerda são geradas por espelhamento controlado, e o renderer
não aplica uma inversão CSS global. Felicidade e queda continuam usando os sprites existentes. A folha não contém
quadros de comer nem uma transição dedicada deitar-se; essas animações não estão implementadas.

O ciclo de caminhada usa o padrão lateral-sequencial como referência (pata traseira esquerda, dianteira esquerda,
traseira direita e dianteira direita), escolhido para esta animação, não como regra universal. A folha fornecida nomeia
as fases visuais como contato, apoio, passagem, impulso e balanço. O controlador ajusta a cadência dos quadros à
velocidade de movimento; no menu `Poses (teste)`, `Andando: próximo quadro` pausa o ciclo para inspeção manual.

Ainda não há interface de conversa nem ação de clique duplo implementada. A janela transparente não tem teste visual
automatizado; a CI valida o carregamento do renderer e a interação IPC no macOS.

### Queda e catálogo de animações
`src/renderer/scripts/animations.js` cataloga estados, quadros, velocidade, repetição, prioridade e variações;
`animationPlayer.js` controla uma sequência por vez e cancela o timer ao trocar ou ocultar a janela. As sequências
usam as poses reais recortadas da folha enviada, incluindo queda de patas para cima, rolamento, aterrissagem e volta
à posição sentada.
O controlador mantém a direção da última caminhada, atualiza-a pelos movimentos horizontais do arraste e escolhe a
variante correspondente. Assim, ao soltar o Chico depois de movê-lo para a direita, ele usa a sequência de queda à
direita; para a esquerda, usa a sequência esquerda. Os testes validam a atlas e seu gerador, o canvas
comum, o canal alfa, a paleta compartilhada e a ausência de pixels claros de fundo.
