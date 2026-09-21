const SECOES = [
  {
    titulo: "O que é o Trilha 30·60·90",
    conteudo: (
      <p>
        Sistema de avaliação de colaboradores novatos (ou em capacitação) nos marcos de{" "}
        <strong>30, 60 e 90 dias</strong> após a admissão. O objetivo é acompanhar a
        evolução do colaborador e indicar treinamentos quando necessário.
      </p>
    ),
  },
  {
    titulo: "Papéis de usuário",
    conteudo: (
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>Admin</strong>: acesso completo — configurações, perguntas, categorias,
          colaboradores, e é o único que pode <strong>excluir</strong> registros e{" "}
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
          quem completou 30, 60 ou 90 dias na data atual.
        </li>
        <li>
          Para cada colaborador que bateu um marco, o sistema cria a avaliação, gera um
          link único com prazo de validade, e envia um e-mail (via Resend) para o gestor.
        </li>
        <li>O gestor responde as perguntas daquele marco direto pelo link, sem login.</li>
        <li>
          Notas 1 ou 2 (baixas) já vêm com uma categoria de treinamento sugerida
          automaticamente; o gestor pode trocar antes de salvar.
        </li>
        <li>
          As respostas alimentam o histórico do colaborador e o dashboard consolidado.
        </li>
      </ol>
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
            <strong>categoria de treinamento sugerida</strong> vinculada a ela.
          </li>
          <li>
            Quando o gestor responde com nota <strong>1 ou 2</strong> naquela pergunta
            específica, o sistema já preenche automaticamente a categoria sugerida daquela
            pergunta como indicação de treinamento.
          </li>
          <li>
            O gestor pode trocar a categoria sugerida por outra (ou remover) antes de
            enviar a avaliação.
          </li>
          <li>
            Notas 3 ou 4 não geram nenhuma sugestão de treinamento.
          </li>
          <li>
            Um colaborador com várias perguntas de nota baixa pode acabar indicado em{" "}
            <strong>mais de uma categoria</strong> ao mesmo tempo — uma por pergunta, não
            uma soma geral.
          </li>
          <li>
            Os KPIs de &quot;Treinamentos indicados&quot; na Visão Geral contam quantas
            respostas (perguntas) apontaram para cada categoria, somando todos os marcos e
            colaboradores.
          </li>
        </ul>
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
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>Visão geral</strong>: contadores, progresso por marco (clique num marco
          pra ver a lista de colaboradores) e pendências/atrasos.
        </li>
        <li>
          <strong>Configurações</strong>: logo da usina, imagem da tela de login, e-mail
          remetente e validade do link de avaliação.
        </li>
        <li>
          <strong>Perguntas</strong>: as perguntas de cada marco (30/60/90) e a categoria
          de treinamento sugerida para nota baixa.
        </li>
        <li>
          <strong>Categorias de treinamento</strong>: cada card mostra quantos
          colaboradores foram indicados para aquele treinamento — clique para ver quem
          são e exportar a lista em CSV.
        </li>
        <li>
          <strong>Colaboradores</strong>: cadastro individual, importação em planilha, e
          o histórico completo de cada um (clique no nome).
        </li>
        <li>
          <strong>Usuários</strong>: lista de quem tem acesso ao sistema (só o admin cria
          novos).
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
