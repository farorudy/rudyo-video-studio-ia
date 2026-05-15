import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: any;
};

const outputSchema = {
  type: "object",
  properties: {
    content: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string" },
          text: { type: "string" },
        },
        required: ["type", "text"],
      },
    },
  },
  required: ["content"],
};

const annotations = {
  readOnlyHint: true,
  openWorldHint: false,
  destructiveHint: false,
};

const tools = [
  {
    name: "generate_storyboard",
    description:
      "Créer un storyboard vidéo structuré à partir d'une idée, d'une chanson, d'une affiche, d'une formation ou d'un événement.",
    inputSchema: {
      type: "object",
      properties: {
        idea: {
          type: "string",
          description: "Idée principale de la vidéo",
        },
        duration: {
          type: "string",
          description: "Durée cible : 30s, 1min, 3min",
        },
        style: {
          type: "string",
          description:
            "Style : clip musical, flyer animé, promo, formation, documentaire",
        },
        audience: {
          type: "string",
          description: "Public cible",
        },
      },
      required: ["idea"],
    },
    outputSchema,
    annotations,
  },
  {
    name: "generate_script",
    description: "Créer un script vidéo ou un texte de voix off.",
    inputSchema: {
      type: "object",
      properties: {
        objective: {
          type: "string",
          description: "Objectif de la vidéo",
        },
        tone: {
          type: "string",
          description:
            "Ton souhaité : professionnel, émotionnel, dynamique, pédagogique",
        },
        duration: {
          type: "string",
          description: "Durée cible",
        },
      },
      required: ["objective"],
    },
    outputSchema,
    annotations,
  },
  {
    name: "analyze_video_idea",
    description: "Analyser et améliorer une idée vidéo.",
    inputSchema: {
      type: "object",
      properties: {
        idea: {
          type: "string",
          description: "Idée vidéo à analyser",
        },
        goal: {
          type: "string",
          description: "Objectif : informer, vendre, former, inspirer, annoncer",
        },
        constraints: {
          type: "string",
          description: "Contraintes : budget, lieu, durée, matériel, équipe",
        },
      },
      required: ["idea"],
    },
    outputSchema,
    annotations,
  },
  {
    name: "organize_video_project",
    description: "Organiser un projet vidéo en étapes de production.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Titre du projet vidéo",
        },
        brief: {
          type: "string",
          description: "Brief du projet",
        },
        deadline: {
          type: "string",
          description: "Échéance",
        },
        resources: {
          type: "string",
          description: "Personnes, matériels, lieux ou fichiers disponibles",
        },
      },
      required: ["brief"],
    },
    outputSchema,
    annotations,
  },
];

function jsonRpcResult(id: string | number | null | undefined, result: any) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    result,
  };
}

function jsonRpcError(
  id: string | number | null | undefined,
  code: number,
  message: string
) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: {
      code,
      message,
    },
  };
}

function callTool(name: string, args: any) {
  if (name === "generate_storyboard") {
    return {
      content: [
        {
          type: "text",
          text:
            `Storyboard généré pour : ${args?.idea ?? ""}\n\n` +
            `Durée : ${args?.duration ?? "non précisée"}\n` +
            `Style : ${args?.style ?? "non précisé"}\n` +
            `Public : ${args?.audience ?? "non précisé"}\n\n` +
            `1. Ouverture : plan d'accroche visuelle.\n` +
            `2. Mise en contexte : présentation du sujet.\n` +
            `3. Développement : scènes principales.\n` +
            `4. Moment fort : message central.\n` +
            `5. Conclusion : appel à l'action.`,
        },
      ],
    };
  }

  if (name === "generate_script") {
    return {
      content: [
        {
          type: "text",
          text:
            `Script vidéo\n\n` +
            `Objectif : ${args?.objective ?? ""}\n` +
            `Ton : ${args?.tone ?? "professionnel"}\n` +
            `Durée : ${args?.duration ?? "non précisée"}\n\n` +
            `Introduction : capter l'attention.\n` +
            `Développement : présenter le message principal.\n` +
            `Conclusion : terminer avec une action claire.`,
        },
      ],
    };
  }

  if (name === "analyze_video_idea") {
    return {
      content: [
        {
          type: "text",
          text:
            `Analyse de l'idée vidéo\n\n` +
            `Idée : ${args?.idea ?? ""}\n` +
            `Objectif : ${args?.goal ?? "non précisé"}\n` +
            `Contraintes : ${args?.constraints ?? "non précisées"}\n\n` +
            `Points forts : idée exploitable et adaptable.\n` +
            `À améliorer : préciser le public cible, le format et le message central.\n` +
            `Recommandation : structurer la vidéo en accroche, contexte, preuve et conclusion.`,
        },
      ],
    };
  }

  if (name === "organize_video_project") {
    return {
      content: [
        {
          type: "text",
          text:
            `Organisation du projet vidéo\n\n` +
            `Titre : ${args?.title ?? "Projet vidéo"}\n` +
            `Brief : ${args?.brief ?? ""}\n` +
            `Échéance : ${args?.deadline ?? "non précisée"}\n` +
            `Ressources : ${args?.resources ?? "non précisées"}\n\n` +
            `Étapes :\n` +
            `1. Clarifier l'objectif.\n` +
            `2. Écrire le script.\n` +
            `3. Préparer le storyboard.\n` +
            `4. Lister les besoins techniques.\n` +
            `5. Tourner ou générer les médias.\n` +
            `6. Monter, vérifier et exporter.`,
        },
      ],
    };
  }

  return {
    content: [
      {
        type: "text",
        text: `Outil inconnu : ${name}`,
      },
    ],
  };
}

function handleJsonRpc(message: JsonRpcRequest) {
  const id = message.id;

  if (message.method === "initialize") {
    return jsonRpcResult(id, {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {},
      },
      serverInfo: {
        name: "rudyo-video-studio-ia",
        version: "1.0.0",
      },
    });
  }

  if (message.method === "notifications/initialized") {
    return null;
  }

  if (message.method === "tools/list") {
    return jsonRpcResult(id, {
      tools,
    });
  }

  if (message.method === "tools/call") {
    const toolName = message.params?.name;
    const toolArgs = message.params?.arguments ?? {};

    if (!toolName) {
      return jsonRpcError(id, -32602, "Nom de l'outil manquant.");
    }

    return jsonRpcResult(id, callTool(toolName, toolArgs));
  }

  return jsonRpcError(
    id,
    -32601,
    `Méthode MCP non supportée : ${message.method}`
  );
}

export async function GET() {
  return NextResponse.json({
    success: true,
    name: "rudyo-video-studio-ia",
    message: "MCP server is running",
    endpoint: "/api/mcp",
    protocol: "JSON-RPC 2.0",
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (Array.isArray(body)) {
      const responses = body
        .map((message) => handleJsonRpc(message))
        .filter(Boolean);

      if (responses.length === 0) {
        return new Response(null, { status: 204 });
      }

      return NextResponse.json(responses);
    }

    const response = handleJsonRpc(body);

    if (!response) {
      return new Response(null, { status: 204 });
    }

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      jsonRpcError(null, -32700, "Erreur JSON-RPC : requête invalide."),
      { status: 400 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, mcp-session-id",
      "Access-Control-Expose-Headers": "Mcp-Session-Id",
    },
  });
}
