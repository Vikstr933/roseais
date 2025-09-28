import Database from 'better-sqlite3';

const db = new Database('./db/db.sqlite');

console.log('Adding AI platforms and model hosting sites...');

// Additional AI platforms and model hosting sites
const aiPlatformsData = [
  {
    name: "Hugging Face",
    description: "The AI community building the future. Open-source AI models, datasets, and applications with a collaborative platform.",
    founded: "2016",
    website: "https://huggingface.co",
    logoUrl: "https://huggingface.co/front/assets/huggingface_logo.svg",
    products: JSON.stringify([
      "Transformers Library",
      "Diffusers",
      "Hub (Model Repository)",
      "Spaces (App Hosting)",
      "Datasets",
      "Gradio (ML Apps)",
      "Accelerate (Training)",
      "PEFT (Parameter Efficient Fine-Tuning)"
    ])
  },
  {
    name: "Replicate",
    description: "Run machine learning models in the cloud. Simple API to run open-source models with one line of code.",
    founded: "2019",
    website: "https://replicate.com",
    logoUrl: "https://replicate.com/images/logo.svg",
    products: JSON.stringify([
      "Model Inference API",
      "Stable Diffusion",
      "DALL-E",
      "Whisper",
      "CLIP",
      "ControlNet",
      "Model Training",
      "Web-based Model Running"
    ])
  },
  {
    name: "Stability AI",
    description: "Building open AI tools that benefit all of humanity. Creators of Stable Diffusion and other generative AI models.",
    founded: "2020",
    website: "https://stability.ai",
    logoUrl: "https://stability.ai/images/logo.svg",
    products: JSON.stringify([
      "Stable Diffusion",
      "Stable Video Diffusion",
      "Stable Audio",
      "Stable LM",
      "Stable Diffusion Web UI",
      "DreamStudio",
      "API Platform",
      "Open Source Models"
    ])
  },
  {
    name: "Runway ML",
    description: "Applied AI research company building the next generation of creative tools for artists and creators.",
    founded: "2018",
    website: "https://runwayml.com",
    logoUrl: "https://runwayml.com/images/logo.svg",
    products: JSON.stringify([
      "Gen-2 (Text-to-Video)",
      "Gen-3 Alpha",
      "Infinite Image",
      "Erase/Restore",
      "Inpainting",
      "Outpainting",
      "Motion Brush",
      "Runway Studio"
    ])
  },
  {
    name: "Midjourney",
    description: "AI-powered image generation platform creating stunning visuals from text descriptions.",
    founded: "2022",
    website: "https://midjourney.com",
    logoUrl: "https://midjourney.com/images/logo.svg",
    products: JSON.stringify([
      "AI Image Generation",
      "Discord Bot Interface",
      "Web Interface",
      "Upscaling",
      "Variations",
      "Remixing",
      "Private Bot Options",
      "Commercial Usage"
    ])
  },
  {
    name: "Civitai",
    description: "Open-source AI community platform for sharing and discovering AI models, with focus on Stable Diffusion.",
    founded: "2022",
    website: "https://civitai.com",
    logoUrl: "https://civitai.com/images/logo.svg",
    products: JSON.stringify([
      "Model Repository",
      "Stable Diffusion Models",
      "LoRA Models",
      "ControlNet Models",
      "Community Discussions",
      "Model Training Guides",
      "Automatic1111 Integration",
      "ComfyUI Integration"
    ])
  },
  {
    name: "EleutherAI",
    description: "Open-source AI research collective focused on understanding and developing large language models.",
    founded: "2020",
    website: "https://eleuther.ai",
    logoUrl: "https://eleuther.ai/images/logo.svg",
    products: JSON.stringify([
      "GPT-Neo",
      "GPT-J",
      "Pile Dataset",
      "The Pile (Training Data)",
      "Open Source LLMs",
      "Research Papers",
      "Community Models",
      "Model Evaluations"
    ])
  },
  {
    name: "LAION",
    description: "Large-scale AI Open Network - Non-profit organization providing large-scale datasets for AI research.",
    founded: "2020",
    website: "https://laion.ai",
    logoUrl: "https://laion.ai/images/logo.svg",
    products: JSON.stringify([
      "LAION-5B Dataset",
      "LAION-Aesthetics",
      "OpenAssistant Dataset",
      "CommonCanvas Dataset",
      "Research Datasets",
      "AI Safety Datasets",
      "Multimodal Datasets",
      "Open Source Tools"
    ])
  }
];

// Insert AI platforms data
const insertCompany = db.prepare(`
  INSERT OR IGNORE INTO companies (name, description, founded, website, logo_url, products)
  VALUES (?, ?, ?, ?, ?, ?)
`);

for (const platform of aiPlatformsData) {
  try {
    insertCompany.run(
      platform.name,
      platform.description,
      platform.founded,
      platform.website,
      platform.logoUrl,
      platform.products
    );
    console.log(`✅ Inserted AI platform: ${platform.name}`);
  } catch (error) {
    console.error(`❌ Failed to insert platform ${platform.name}:`, error);
  }
}

console.log('🎉 AI platforms added successfully!');
db.close();
