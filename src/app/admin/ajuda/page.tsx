const SECOES = [
  {
    titulo: "O que é o Trilha Desenvolve+",
    conteudo: (
      <p>
        Sistema de acompanhamento de integração, capacitação e desenvolvimento de
        colaboradores novatos (ou em capacitação), com avaliações nos marcos de{" "}
        <strong>30, 60, 90, 120, 180 e 270 dias</strong> após a admissão. O objetivo é
        acompanhar a evolução do colaborador e indicar treinamentos quando necessário.
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
          planilha CSV) com nome, matrícula, data de admissão e os dados do gestor
          responsável.
        </li>
        <li>
          Todo dia, uma rotina automática (pg_cron + Edge Function no Supabase) verifica
          quem completou 30, 60, 90, 120, 180 ou 270 dias na data atual — e também tenta
          de novo qualquer avaliação que tenha ficado presa sem enviar nos últimos dias.
        </li>
        <li>
          Para cada colaborador que bateu um marco, o sistema cria a avaliação, gera um
          link único com prazo de validade, e envia um e-mail (via Gmail, SMTP) para o
          gestor.
        </li>
        <li>O gestor responde as perguntas daquele marco direto pelo link, sem login.</li>
        <li>
          Notas 1 ou 2 (baixas) já vêm com uma competência sugerida
          automaticamente; o gestor pode trocar antes de salvar.
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
            <strong>Pendente</strong>: a avaliação foi criada (bateu o marco), mas o
            sistema ainda não confirmou o envio do e-mail.
          </li>
          <li>
            <strong>Aguardando resposta</strong>: o e-mail foi enviado ao gestor e o link
            está esperando a resposta dele.
          </li>
          <li>
            <strong>Respondida</strong>: o gestor já enviou as respostas daquele marco.
          </li>
          <li>
            <strong>Expirada</strong>: passou do prazo configurado em{" "}
            <strong>Configurações → Validade do link de avaliação</strong> sem resposta.
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
      </>
    ),
  },
  {
    titulo: "Como funciona a nota e a sugestão de treinamento",
    conteudo: (
      <>
        <p>
          Não existe uma soma ou média das notas. Cada pergunta é avaliada{" "}
          <strong>individualmente</strong>, numa escala de 1 a 4:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Cada pergunta (cadastrada em <strong>Perguntas</strong>) pode ter uma{" "}
            <strong>competência sugerida</strong> vinculada a ela.
          </li>
          <li>
            Quando o gestor responde com nota <strong>1 ou 2</strong> naquela pergunta
            específica, o sistema já preenche automaticamente a competência sugerida daquela
            pergunta como indicação de treinamento.
          </li>
          <li>
            O gestor pode trocar a competência sugerida por outra (ou remover) antes de
            enviar a avaliação.
          </li>
          <li>
            Notas 3 ou 4 não geram nenhuma sugestão de treinamento.
          </li>
          <li>
            Um colaborador com várias perguntas de nota baixa pode acabar indicado em{" "}
            <strong>mais de uma competência</strong> ao mesmo tempo — uma por pergunta, não
            uma soma geral.
          </li>
          <li>
            Os KPIs de &quot;Treinamentos indicados&quot; na Visão Geral contam quantas
            respostas (perguntas) apontaram para cada competência, somando todos os marcos e
            colaboradores.
          </li>
        </ul>
      </>
    ),
  },
  {
    titulo: "Perguntas por cargo",
    conteudo: (
      <>
        <p>
          Cada pergunta pode ser <strong>geral</strong> (aparece pra qualquer colaborador,
          é o padrão) ou marcada pra um <strong>cargo</strong> específico, cadastrado na
          tela <strong>Cargos</strong>. Uma pergunta com cargo só aparece no formulário de
          quem tem aquele cargo.
        </p>
        <p className="mt-2">
          Exemplo: uma pergunta geral do tipo &quot;Chegou no horário durante o período?&quot;
          aparece pra todo mundo, mas &quot;Operou o trator com segurança?&quot; pode ficar
          restrita ao cargo <strong>Tratorista</strong>, sem aparecer pra quem tem outro
          cargo (ou nenhum cargo definido).
        </p>
        <p className="mt-2">
          Um colaborador sem cargo cadastrado só recebe as perguntas gerais.
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
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong>Visão geral</strong>: cinco cards no topo (Colaboradores ativos,
          Aguardando resposta, Respondidas, Expiradas, Notas críticas) — cada um é também
          um filtro, clique pra aplicar. Abaixo: a tabela <strong>Progresso por marco</strong>{" "}
          (clique em qualquer marco — 30/60/90/120/180/270 dias — pra filtrar só aquele),{" "}
          <strong>Treinamentos indicados</strong> (um card por competência, com a contagem de
          respostas que apontaram pra ela — clique pra ver quem são e exportar em CSV), e a
          tabela de <strong>Avaliações</strong> com os filtros aplicados, mais o botão{" "}
          <strong>Exportar tudo</strong>.
        </li>
        <li>
          <strong>Configurações</strong>: logo da usina e imagem da tela de login (upload de
          até 10&nbsp;MB cada), nome e e-mail do remetente dos e-mails de avaliação, e a
          validade do link de avaliação em dias (depois desse prazo sem resposta, a
          avaliação passa pra &quot;Expirada&quot;).
        </li>
        <li>
          <strong>Perguntas</strong>: cadastro das perguntas de cada marco (30 a 270 dias),
          cada uma podendo ter uma competência sugerida pra quando a nota vier baixa e,
          opcionalmente, um cargo específico (deixando em branco, vale pra todos). Dá pra
          ativar/desativar uma pergunta (ela some do formulário do gestor, mas o histórico
          de quem já respondeu fica intacto) e, só o admin, excluir.
        </li>
        <li>
          <strong>Competências</strong>: um formulário pra criar competência (nome +
          descrição) e outro pra criar um treinamento específico dentro de uma competência
          já existente. Cada competência aparece como um card com os treinamentos
          cadastrados dentro dela, e dá pra editar/ativar-desativar/excluir tanto a
          competência quanto cada treinamento.
        </li>
        <li>
          <strong>Cargos</strong>: cadastro simples (nome + descrição) usado pra restringir
          perguntas específicas a colaboradores de um cargo (ex: Tratorista, Operador,
          Gestor). Veja a seção &quot;Perguntas por cargo&quot; acima.
        </li>
        <li>
          <strong>Colaboradores</strong>: formulário de cadastro individual e outro pra
          importar uma planilha CSV em lote. A listagem mostra matrícula, tipo (novato ou em
          capacitação), cargo, data de admissão, gestor responsável, status (ativo/inativo)
          e o próximo marco pendente daquele colaborador, com o botão de forçar envio do
          e-mail. Clicar no nome abre o histórico completo de todos os marcos.
        </li>
        <li>
          <strong>Usuários</strong>: lista de quem tem login no sistema (nome, e-mail,
          papel, status). O formulário pra criar um novo usuário só aparece pra quem é
          admin.
        </li>
        <li>
          <strong>Ajuda</strong>: esta página.
        </li>
      </ul>
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
