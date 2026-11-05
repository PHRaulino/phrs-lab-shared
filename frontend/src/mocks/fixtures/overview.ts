import type { Overview } from "../../app/core/services/overview.service";

export const overviewFixture: Overview = {
  stats: [
    {
      label: "Projetos no workspace",
      value: "03",
      detail: "Espaço para suas próximas ideias",
    },
    {
      label: "Serviços conectados",
      value: "01",
      detail: "API de demonstração disponível",
    },
    {
      label: "Ambiente",
      value: "Local",
      detail: "Tudo pronto para desenvolver",
    },
  ],
  activity: [
    {
      title: "Seu workspace está pronto",
      description: "Uma base organizada para começar a construir.",
      time: "Agora",
    },
    {
      title: "Integração de exemplo disponível",
      description: "Os dados desta página vêm de uma requisição HTTP.",
      time: "Setup inicial",
    },
    {
      title: "Estrutura criada",
      description: "Layout, navegação e rotas no mesmo lugar.",
      time: "Setup inicial",
    },
  ],
};
