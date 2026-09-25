import { NOTAS } from "@/lib/escala";

const SECOES = [
  {
    titulo: "O que é o Trilha Desenvolve+",
    conteudo: (
      <p>
        Sistema de acompanhamento de integração, capacitação e desenvolvimento de
        colaboradores novatos (ou em capacitação), com avaliações em períodos que vão de{" "}
        <strong>30 a 270 dias</strong> após a admissão — quais períodos exatamente
        dependem do <strong>cargo</strong> do colaborador (veja a seção &quot;Cargos:
        períodos e perguntas específicas&quot; abaixo). O objetivo é acompanhar a evolução do
        colaborador e indicar treinamentos quando necessário.
      </p>
    ),
  },
  {
    titulo: "Papéis de usuário",
    conteudo: (
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>Admin</strong>: acesso completo — configurações, perguntas, competências,
          cargos, colaboradores, e é o único que pode <strong>excluir</strong> registros e{" "}
          <strong>criar novos usuários</strong>.
        </li>
        <li>
          <strong>Analista</strong>: mesmo painel do admin (pode cadastrar e editar em
          todas as telas), mas não vê a opção de excluir nem a de criar usuário.
        </li>
        <li>
          <strong>Gestor</strong>: não é um usuário do sistema — é só o nome/e-mail
          cadastrado em cada colaborador. Ele recebe o e-mail com o link de avaliação e
          responde direto por ele, sem precisar fazer login.
        </li>
      </ul>
    ),
  },
  {
    titulo: "Como funciona o fluxo, do início ao fim",
    conteudo: (
      <ol className="list-decimal space-y-1 pl-5">
        <li>
          Admin ou analista cadastra o colaborador (individualmente ou importando uma
          planilha CSV) com nome, matrícula, tipo e os dados do gestor responsável. O tipo
          define de onde os períodos contam: <strong>Novato</strong> usa a data de
          admissão; <strong>Capacitação</strong> (mudança de cargo) usa a data em que ele
          mudou de cargo. É um calendário só no cadastro, e a Visão geral filtra por tipo.
        </li>
        <li>
          Todo dia, uma rotina automática (pg_cron + Edge Function no Supabase) verifica
          quem completou, na data atual, um dos períodos configurados pro cargo daquele
          colaborador (ou 30/60/90 como padrão, se ele não tiver cargo cadastrado) — e
          também tenta de novo qualquer avaliação que tenha ficado presa sem enviar nos
          últimos dias.
        </li>
        <li>
          Para cada colaborador que bateu um período, o sistema cria a avaliação, gera um
          link único com prazo de validade, e envia um e-mail (via Gmail, SMTP) para o
          gestor.
        </li>
        <li>
          O gestor responde as perguntas daquele período direto pelo link, sem login. Ele
          pode <strong>salvar rascunho</strong> e continuar depois pelo mesmo link (dentro do
          prazo); ao clicar em <strong>Enviar</strong>, vê um resumo e escolhe entre
          revisar ou confirmar o envio.
        </li>
        <li>
          Notas 1, 2 ou 3 já vêm com uma competência sugerida automaticamente; o gestor
          pode escolher o treinamento antes de enviar.
        </li>
        <li>
          As respostas alimentam o histórico do colaborador e o dashboard consolidado.
        </li>
      </ol>
    ),
  },
  {
    titulo: "Status de uma avaliação e envio manual",
    conteudo: (
      <>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Pendente</strong>: a avaliação foi criada (bateu o período), mas o
            sistema ainda não confirmou o envio do e-mail.
          </li>
          <li>
            <strong>Aguardando resposta</strong>: o e-mail foi enviado ao gestor e o link
            está esperando a resposta dele.
          </li>
          <li>
            <strong>Respondida</strong>: o gestor já enviou as respostas daquele período.
          </li>
          <li>
            <strong>Expirada</strong>: passou do prazo configurado em{" "}
            <strong>Configurações → Validade do link de avaliação</strong> sem resposta.
            Normalmente dura pouco: a rotina manda um lembrete (ver abaixo) e ela volta
            pra &quot;Aguardando resposta&quot;. Fica expirada de vez só se o colaborador
            estiver inativo.
          </li>
          <li>
            <strong>Lembrete automático</strong>: enquanto o gestor não responde, a rotina
            diária manda um link novo por e-mail <strong>a cada 5 dias</strong>, sem limite,
            até ele responder (ou usar &quot;Não é possível avaliar&quot;). O rascunho que
            ele tiver salvo continua no link novo. A página do colaborador mostra quantos
            lembretes já foram e quando saiu o último.
          </li>
          <li>
            <strong>Não avaliada</strong>: o gestor usou &quot;Não é possível avaliar este
            colaborador&quot; no link e informou <strong>afastado</strong> ou{" "}
            <strong>desligado</strong> (com observação opcional). O período é encerrado sem
            notas. Desligado não inativa o colaborador sozinho: aparece um aviso na Visão
            geral pra o DHO conferir e inativar no cadastro. Se um afastado voltar, o admin
            pode usar &quot;Reabrir para o gestor&quot;.
          </li>
        </ul>
        <p className="mt-2">
          Em <strong>Colaboradores</strong> (na listagem ou na página de cada colaborador),
          toda avaliação que ainda não foi respondida tem um botão{" "}
          <strong>&quot;Forçar envio do e-mail&quot;</strong>: ele gera (ou renova) o link e
          tenta mandar o e-mail na hora — útil se o gestor não recebeu o automático ou se o
          link expirou. Se o envio por e-mail falhar por qualquer motivo, o link ainda é
          gerado normalmente e fica disponível no botão{" "}
          <strong>&quot;Copiar link (WhatsApp/e-mail manual)&quot;</strong>, pra mandar por
          fora do sistema.
        </p>
        <p className="mt-2">
          Se o gestor já enviou mas precisa mudar alguma nota, o admin usa{" "}
          <strong>&quot;Reabrir para o gestor&quot;</strong> na página do colaborador: a
          avaliação volta pra &quot;Aguardando resposta&quot;, sai um link novo por e-mail e as
          notas anteriores já vêm preenchidas pra ele ajustar e enviar de novo.
        </p>
      </>
    ),
  },
  {
    titulo: "Limite de envio de e-mail (Gmail)",
    conteudo: (
      <>
        <p>
          O sistema envia os e-mails de avaliação via SMTP de uma conta{" "}
          <strong>Gmail comum</strong> (não é Google Workspace/empresarial). Isso tem um
          limite imposto pelo próprio Google:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>500 destinatários por dia</strong>, numa janela móvel de 24 horas (não
            é por semana nem por mês — o limite vai liberando aos poucos conforme as 24h
            de cada envio antigo vão passando).
          </li>
          <li>
            O limite conta <strong>destinatários</strong>, não &quot;e-mails&quot;. Como
            cada avaliação daqui manda um e-mail pra um único gestor, na prática dá pra
            enviar até <strong>500 avaliações por dia</strong> antes de bater no teto.
          </li>
          <li>
            Se o limite for atingido, o Gmail passa a recusar novos envios até a janela de
            24h liberar espaço — as avaliações continuam sendo criadas normalmente no
            sistema, só o e-mail que falharia (o link ainda fica disponível pra copiar e
            mandar manualmente, como descrito acima).
          </li>
        </ul>
        <p className="mt-2">
          Pra uma usina com centenas de colaboradores batendo período no mesmo dia, isso
          dificilmente vira problema — mas se algum dia for necessário um volume maior,
          o caminho é migrar pra uma conta <strong>Google Workspace</strong> (limite
          costuma subir pra 2.000/dia) ou um serviço de envio dedicado (ex: Resend,
          SendGrid).
        </p>
      </>
    ),
  },
  {
    titulo: "Como funciona a nota e a sugestão de treinamento",
    conteudo: (
      <>
        <p>
          Não existe uma soma ou média das notas. Cada pergunta é avaliada{" "}
          <strong>individualmente</strong>, numa régua de 1 a 5:
        </p>
        <ul className="mb-2 list-disc space-y-1 pl-5">
          {NOTAS.map((nota) => (
            <li key={nota.valor}>
              <strong style={{ color: nota.cor }}>
                {nota.valor} – {nota.nome}
              </strong>
              : {nota.descricao}
            </li>
          ))}
        </ul>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Cada pergunta (cadastrada em <strong>Perguntas</strong>) pode ter uma{" "}
            <strong>competência sugerida</strong> vinculada a ela.
          </li>
          <li>
            Quando o gestor responde com nota <strong>1, 2 ou 3</strong> naquela pergunta
            específica, o sistema já preenche automaticamente a competência sugerida daquela
            pergunta como indicação de treinamento.
          </li>
          <li>
            O gestor pode trocar a competência sugerida por outra (ou remover) antes de
            enviar a avaliação.
          </li>
          <li>
            Notas 4 ou 5 não geram nenhuma sugestão de treinamento. A nota 1 (Inaceitável)
            também conta como <strong>nota crítica</strong> na Visão geral.
          </li>
          <li>
            Um colaborador com várias perguntas de nota baixa pode acabar indicado em{" "}
            <strong>mais de uma competência</strong> ao mesmo tempo — uma por pergunta, não
            uma soma geral.
          </li>
          <li>
            Os KPIs de &quot;Treinamentos indicados&quot; na Visão Geral contam quantas
            respostas (perguntas) apontaram para cada competência, somando todos os períodos e
            colaboradores.
          </li>
        </ul>
      </>
    ),
  },
  {
    titulo: "Cargos: períodos e perguntas específicas",
    conteudo: (
      <>
        <p>
          Cada <strong>cargo</strong> (cadastrado na tela Cargos) define dois pontos
          independentes:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Em quais períodos ele é avaliado</strong> — marcado por checkbox na
            própria tela de Cargos. Um colaborador com esse cargo só vai gerar avaliação
            nos períodos marcados ali (ex: Gestores avalia em todos os períodos — 30 a 270 dias —
            enquanto Tratorista, Operador de colhedora e Auxiliar de processo avaliam só
            em 30/60/90). Colaborador sem cargo cadastrado usa o padrão 30/60/90.
          </li>
          <li>
            <strong>Quais perguntas ele recebe</strong> — cada pergunta pode ser{" "}
            <strong>geral</strong> (aparece pra qualquer colaborador, é o padrão) ou
            marcada pra um cargo específico. Uma pergunta com cargo só aparece no
            formulário de quem tem aquele cargo, e o campo Período do formulário de
            pergunta se ajusta automaticamente aos períodos daquele cargo.
          </li>
        </ul>
        <p className="mt-2">
          Exemplo: a pergunta de 30 dias do <strong>Gestor</strong> é um registro
          diferente da pergunta de 30 dias do <strong>Tratorista</strong>, mesmo os dois
          tendo período 30 — e o Gestor ainda responde perguntas específicas em períodos
          (120/180/270) que o Tratorista nunca chega a ter.
        </p>
        <p className="mt-2">
          Um colaborador sem cargo cadastrado só recebe as perguntas gerais, nos períodos
          padrão 30/60/90.
        </p>
      </>
    ),
  },
  {
    titulo: "Exemplo prático: avaliação de 30 dias",
    conteudo: (
      <>
        <p>
          Escala de 1 (insatisfatório) a 4 (excelente). Veja como ficaria uma avaliação
          respondida pelo gestor de um colaborador fictício:
        </p>
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-primary-border/60 bg-primary-soft/40 p-4 not-italic">
          <p className="font-medium text-primary">
            Avaliação de 30 dias — Colaborador: João da Silva
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              O colaborador compreendeu suas atribuições e responsabilidades no cargo?
              <br />→ Nota <strong>4</strong> (nenhuma sugestão, nota boa)
            </li>
            <li className="text-red-700 dark:text-red-400">
              O colaborador seguiu as normas de segurança do trabalho apresentadas na
              integração?
              <br />→ Nota <strong>1</strong> ⚠ → sistema sugere automaticamente{" "}
              <strong>&quot;Segurança do trabalho&quot;</strong> (o gestor pode trocar ou
              remover antes de enviar)
            </li>
            <li>
              O colaborador demonstrou assiduidade e pontualidade no período?
              <br />→ Nota <strong>3</strong> (nenhuma sugestão)
            </li>
            <li>
              O colaborador se relacionou bem com a equipe e demonstrou boa comunicação?
              <br />→ Nota <strong>4</strong> (nenhuma sugestão)
            </li>
            <li className="text-red-700 dark:text-red-400">
              O colaborador demonstrou interesse e proatividade no aprendizado das
              atividades?
              <br />→ Nota <strong>2</strong> ⚠ → sistema sugere{" "}
              <strong>&quot;Liderança e proatividade&quot;</strong>
            </li>
          </ul>
          <p className="text-zinc-500">
            Comentário (opcional, por pergunta): &quot;Ainda se atrapalha um pouco com os
            EPIs, mas está aprendendo rápido.&quot;
          </p>
        </div>
        <p className="mt-2">
          Resultado: esse colaborador fica indicado em <strong>2 treinamentos</strong>{" "}
          (Segurança do trabalho + Liderança e proatividade) e, por ter tirado nota 1,
          aparece com o selo <strong>&quot;⚠ Atenção&quot;</strong> na listagem de
          colaboradores, no histórico dele e na lista de avaliações da Visão Geral — além
          de contar no card <strong>&quot;Notas críticas&quot;</strong>.
        </p>
      </>
    ),
  },
  {
    titulo: "Onde encontrar cada coisa no painel",
    conteudo: (
      <>
        <p className="mb-2 text-zinc-500">
          Segue a mesma ordem do menu lateral: Visão geral, Cargos, Competências,
          Perguntas, Colaboradores, Usuários, Configurações, Ajuda.
        </p>
        <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong>Visão geral</strong>: cinco cards no topo (Colaboradores ativos,
          Aguardando resposta, Respondidas, Expiradas, Notas críticas) — cada um é também
          um filtro, clique pra aplicar. Abaixo: a tabela <strong>Progresso por período</strong>{" "}
          (clique em qualquer período — 30/45/60/90/120/180/270 dias — pra filtrar só aquele),{" "}
          <strong>Treinamentos indicados</strong> (um card por competência, com a contagem de
          respostas que apontaram pra ela — clique pra ver quem são e exportar em CSV), e a
          tabela de <strong>Avaliações</strong> com os filtros aplicados, mais o botão{" "}
          <strong>Exportar tudo</strong>.
        </li>
        <li>
          <strong>Cargos</strong>: formulário pra criar cargo (nome + descrição) com
          checkboxes dos períodos em que ele é avaliado (padrão 30/60/90, marque os outros
          se precisar). A listagem mostra os períodos de cada cargo e permite editar/
          ativar-desativar/excluir. Veja a seção &quot;Cargos: períodos e perguntas
          específicas&quot; acima.
        </li>
        <li>
          <strong>Competências</strong>: um formulário pra criar competência (nome +
          descrição) e outro pra criar um treinamento específico dentro de uma competência
          já existente. A competência vale pra todos os cargos; o treinamento pode ser de
          um cargo só ou de &quot;Todos os cargos&quot;. Na avaliação, o gestor só vê os
          treinamentos do cargo de quem está avaliando, mais os de todos os cargos. Cada
          competência aparece como um card com os treinamentos agrupados por cargo, e dá
          pra editar/ativar-desativar/excluir tanto a competência quanto cada treinamento.
        </li>
        <li>
          <strong>Perguntas</strong>: cadastro das perguntas, cada uma podendo ter uma
          competência sugerida pra quando a nota vier baixa e, opcionalmente, um cargo
          específico (deixando em branco, vale pra todos — e o campo Período se ajusta aos
          períodos do cargo escolhido). Os filtros no topo da lista (por cargo) restringem
          o que aparece nas seções abaixo. Cada pergunta tem um menu de ações com{" "}
          <strong>Editar</strong> (período, cargo, texto e competência sugerida),
          ativar/desativar (ela some do formulário do gestor, mas o histórico de quem já
          respondeu fica intacto) e, só o admin, excluir.
        </li>
        <li>
          <strong>Colaboradores</strong>: formulário de cadastro individual e outro pra
          importar uma planilha em lote (aceita .xlsx direto do Excel ou .csv). A listagem
          mostra matrícula, cargo, data de
          admissão, gestor responsável, status (ativo/inativo) e o próximo período pendente
          daquele colaborador, com o botão de forçar envio do e-mail. Clicar no nome abre o
          histórico completo de todos os períodos daquele colaborador (que variam conforme
          o cargo dele).
        </li>
        <li>
          <strong>Usuários</strong>: lista de quem tem login no sistema (nome, e-mail,
          papel, status). O formulário pra criar um novo usuário só aparece pra quem é
          admin.
        </li>
        <li>
          <strong>Configurações</strong>: logo da usina e imagem da tela de login (upload de
          até 10&nbsp;MB cada), nome e e-mail do remetente dos e-mails de avaliação, e a
          validade do link de avaliação em dias (depois desse prazo sem resposta, a
          avaliação passa pra &quot;Expirada&quot;).
        </li>
        <li>
          <strong>Ajuda</strong>: esta página.
        </li>
        </ul>
      </>
    ),
  },
  {
    titulo: "Retenção de dados (privacidade)",
    conteudo: (
      <p>
        Seis meses após a data de admissão, o sistema remove automaticamente os dados
        pessoais do colaborador e do gestor daquele registro (nome, matrícula, e-mail),
        mantendo apenas o histórico de notas e treinamentos indicados para as
        estatísticas continuarem corretas. Essa limpeza roda todo dia de madrugada.
      </p>
    ),
  },
];

export default function AjudaPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <h1 className="text-xl font-semibold">Ajuda</h1>

      {SECOES.map((secao) => (
        <div key={secao.titulo} className="flex flex-col gap-2">
          <h2 className="font-medium text-primary">{secao.titulo}</h2>
          <div className="text-sm text-zinc-700 dark:text-zinc-300">{secao.conteudo}</div>
        </div>
      ))}
    </div>
  );
}
