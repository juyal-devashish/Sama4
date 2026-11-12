import { EntityType } from '../components/entity-badge';

export interface ArticleEntity {
  id: string;
  text: string;
  type: EntityType;
  priority: 'high' | 'medium' | 'low';
  context: string;
  mentionCount: number;
  inTitle: boolean;
}

export interface Article {
  id: string;
  title: string;
  summary: string;
  source: string;
  sourceFavicon: string;
  author: string;
  timeAgo: string;
  readTime: string;
  category: string;
  image: string;
  imageCredit?: string;
  entities: ArticleEntity[];
  content: string; // Full article content with entity markers
}

export const mockArticles: Article[] = [
  {
    id: '1',
    title: 'OpenAI Unveils GPT-5 with Revolutionary Reasoning Capabilities',
    summary: 'OpenAI today announced the release of GPT-5, marking a significant milestone in artificial intelligence development. The new model demonstrates unprecedented capabilities in complex reasoning and multi-step problem solving, outperforming its predecessor by 40% on reasoning benchmarks.',
    source: 'TechCrunch',
    sourceFavicon: '🔵',
    author: 'Sarah Chen',
    timeAgo: '2h ago',
    readTime: '4 min read',
    category: 'Technology',
    image: 'https://images.unsplash.com/photo-1625314887424-9f190599bd56?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcnRpZmljaWFsJTIwaW50ZWxsaWdlbmNlJTIwcm9ib3R8ZW58MXx8fHwxNzcwNTY0OTU5fDA&ixlib=rb-4.1.0&q=80&w=1080',
    imageCredit: 'TechCrunch',
    entities: [
      {
        id: 'e1',
        text: 'OpenAI',
        type: 'organization',
        priority: 'high',
        context: 'OpenAI is an artificial intelligence research laboratory consisting of the for-profit corporation OpenAI LP and its parent company, the non-profit OpenAI Inc. Founded in 2015, it is known for developing ChatGPT and other advanced AI systems.',
        mentionCount: 5,
        inTitle: true
      },
      {
        id: 'e2',
        text: 'GPT-5',
        type: 'concept',
        priority: 'high',
        context: 'GPT-5 is the latest iteration of OpenAI\'s Generative Pre-trained Transformer series. It represents a significant advancement in large language model capabilities, particularly in reasoning and problem-solving.',
        mentionCount: 8,
        inTitle: true
      },
      {
        id: 'e3',
        text: 'Sam Altman',
        type: 'person',
        priority: 'medium',
        context: 'Sam Altman is the CEO of OpenAI. He previously led Y Combinator and has been instrumental in shaping OpenAI\'s vision for artificial general intelligence.',
        mentionCount: 3,
        inTitle: false
      }
    ],
    content: `<entity id="e1" priority="high">OpenAI</entity> today announced the release of <entity id="e2" priority="high">GPT-5</entity>, marking a significant milestone in artificial intelligence development. The new model demonstrates unprecedented capabilities in complex reasoning and multi-step problem solving.\n\n<entity id="e3" priority="medium">Sam Altman</entity>, CEO of <entity id="e1" priority="high">OpenAI</entity>, described the release as "the beginning of a new era in AI capabilities." The model shows particular strength in tasks requiring extended reasoning chains and logical deduction.\n\nEarly benchmarks suggest <entity id="e2" priority="high">GPT-5</entity> outperforms its predecessor by 40% on complex reasoning tasks. The model was trained on a diverse dataset and incorporates novel architectural improvements that enable more coherent long-form reasoning.`
  },
  {
    id: '2',
    title: 'Federal Reserve Signals Potential Rate Cuts Amid Economic Uncertainty',
    summary: 'Chair Powell hints at policy shift as inflation shows signs of cooling and growth concerns mount. In testimony before Congress, Powell noted that inflation has shown consistent signs of cooling, approaching the Fed\'s 2% target. However, he emphasized that the Federal Reserve remains data-dependent.',
    source: 'Reuters',
    sourceFavicon: '🔴',
    author: 'Michael Torres',
    timeAgo: '4h ago',
    readTime: '5 min read',
    category: 'Finance',
    image: 'https://images.unsplash.com/photo-1766218329569-53c9270bb305?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaW5hbmNpYWwlMjBtYXJrZXRzJTIwZWNvbm9teXxlbnwxfHx8fDE3NzA1ODc5NDd8MA&ixlib=rb-4.1.0&q=80&w=1080',
    imageCredit: 'Reuters',
    entities: [
      {
        id: 'e4',
        text: 'Federal Reserve',
        type: 'organization',
        priority: 'high',
        context: 'The Federal Reserve is the central banking system of the United States. It sets monetary policy, supervises banks, maintains financial stability, and provides banking services.',
        mentionCount: 6,
        inTitle: true
      },
      {
        id: 'e5',
        text: 'Jerome Powell',
        type: 'person',
        priority: 'high',
        context: 'Jerome Powell is the current Chair of the Federal Reserve, appointed in 2018. He has led the Fed through unprecedented economic challenges including the pandemic and subsequent inflation surge.',
        mentionCount: 4,
        inTitle: false
      }
    ],
    content: `The <entity id="e4" priority="high">Federal Reserve</entity> signaled a potential shift in monetary policy today, with Chair <entity id="e5" priority="high">Jerome Powell</entity> indicating that rate cuts may be on the horizon if economic conditions continue to soften.\n\nIn testimony before Congress, <entity id="e5" priority="high">Powell</entity> noted that inflation has shown consistent signs of cooling, approaching the Fed's 2% target. However, he emphasized that the <entity id="e4" priority="high">Federal Reserve</entity> remains data-dependent and will carefully monitor economic indicators before making policy changes.`
  },
  {
    id: '3',
    title: 'Major Climate Summit Reaches Historic Agreement on Carbon Emissions',
    summary: '190 nations commit to unprecedented emissions reductions, with binding targets for 2030. The accord significantly strengthens global commitments to reduce carbon emissions, building upon the Paris Agreement with more aggressive targets and enforcement mechanisms.',
    source: 'BBC News',
    sourceFavicon: '🟠',
    author: 'Emma Whitfield',
    timeAgo: '6h ago',
    readTime: '6 min read',
    category: 'World',
    image: 'https://images.unsplash.com/photo-1616443586071-cd1f0a65ef5e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjbGltYXRlJTIwZW52aXJvbm1lbnQlMjBuYXR1cmV8ZW58MXx8fHwxNzcwNTU5MzIxfDA&ixlib=rb-4.1.0&q=80&w=1080',
    imageCredit: 'BBC News',
    entities: [
      {
        id: 'e6',
        text: 'COP29',
        type: 'event',
        priority: 'high',
        context: 'COP29 is the 29th Conference of the Parties to the United Nations Framework Convention on Climate Change. It brings together world leaders to negotiate global climate action.',
        mentionCount: 7,
        inTitle: false
      },
      {
        id: 'e7',
        text: 'Paris Agreement',
        type: 'concept',
        priority: 'medium',
        context: 'The Paris Agreement is a legally binding international treaty on climate change, adopted in 2015. It aims to limit global warming to well below 2°C above pre-industrial levels.',
        mentionCount: 3,
        inTitle: false
      }
    ],
    content: `The <entity id="e6" priority="high">COP29</entity> climate summit concluded today with a landmark agreement that significantly strengthens global commitments to reduce carbon emissions. The accord, signed by 190 nations, builds upon the <entity id="e7" priority="medium">Paris Agreement</entity> with more aggressive targets and enforcement mechanisms.`
  },
  {
    id: '4',
    title: 'Breakthrough in Cancer Treatment Shows 90% Success Rate in Clinical Trials',
    summary: 'A revolutionary CAR-T therapy has shown unprecedented success in phase III clinical trials, with a 90% response rate across multiple cancer types. The treatment, which is expected to receive FDA approval within months, represents a major breakthrough in oncology.',
    source: 'Nature Medicine',
    sourceFavicon: '🟢',
    author: 'Dr. Priya Sharma',
    timeAgo: '8h ago',
    readTime: '7 min read',
    category: 'Health',
    image: 'https://images.unsplash.com/photo-1768498950658-87ecfe232b59?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoZWFsdGhjYXJlJTIwbWVkaWNhbCUyMHNjaWVuY2V8ZW58MXx8fHwxNzcwNTg3OTQ3fDA&ixlib=rb-4.1.0&q=80&w=1080',
    imageCredit: 'Nature Medicine',
    entities: [
      {
        id: 'e8',
        text: 'CAR-T therapy',
        type: 'concept',
        priority: 'high',
        context: 'CAR-T (Chimeric Antigen Receptor T-cell) therapy is a type of immunotherapy that uses genetically modified T cells to fight cancer. The patient\'s own immune cells are engineered to recognize and attack cancer cells.',
        mentionCount: 9,
        inTitle: false
      },
      {
        id: 'e9',
        text: 'FDA',
        type: 'organization',
        priority: 'medium',
        context: 'The FDA (Food and Drug Administration) is the federal agency responsible for protecting public health by regulating food, drugs, medical devices, and other products in the United States.',
        mentionCount: 2,
        inTitle: false
      }
    ],
    content: `A revolutionary <entity id="e8" priority="high">CAR-T therapy</entity> has shown unprecedented success in phase III clinical trials, with a 90% response rate across multiple cancer types. The treatment, which is expected to receive <entity id="e9" priority="medium">FDA</entity> approval within months, represents a major breakthrough in oncology.`
  },
  {
    id: '5',
    title: 'Tech Giants Face Antitrust Probe Over AI Market Dominance',
    summary: 'The European Commission has launched a formal antitrust investigation into major technology companies\' practices in the AI market. The probe, conducted under the Digital Markets Act, examines whether these companies are leveraging their existing market positions to unfairly dominate the emerging AI sector.',
    source: 'The Wall Street Journal',
    sourceFavicon: '⚫',
    author: 'James Rodriguez',
    timeAgo: '10h ago',
    readTime: '5 min read',
    category: 'Technology',
    image: 'https://images.unsplash.com/photo-1758525588803-fc7dc8096ba1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBjaXR5JTIwbmV3cyUyMHRlY2hub2xvZ3l8ZW58MXx8fHwxNzcwNTg3OTQ0fDA&ixlib=rb-4.1.0&q=80&w=1080',
    imageCredit: 'WSJ',
    entities: [
      {
        id: 'e10',
        text: 'European Commission',
        type: 'organization',
        priority: 'high',
        context: 'The European Commission is the executive branch of the European Union, responsible for proposing legislation, implementing decisions, and enforcing EU law. It plays a key role in antitrust enforcement.',
        mentionCount: 4,
        inTitle: false
      },
      {
        id: 'e11',
        text: 'Digital Markets Act',
        type: 'concept',
        priority: 'medium',
        context: 'The Digital Markets Act (DMA) is EU legislation designed to ensure fair competition in digital markets by regulating large online platforms designated as "gatekeepers."',
        mentionCount: 3,
        inTitle: false
      }
    ],
    content: `The <entity id="e10" priority="high">European Commission</entity> has launched a formal antitrust investigation into major technology companies' practices in the AI market. The probe, conducted under the <entity id="e11" priority="medium">Digital Markets Act</entity>, examines whether these companies are leveraging their existing market positions to unfairly dominate the emerging AI sector.`
  },
  {
    id: '6',
    title: 'Global Trade Summit Addresses Supply Chain Disruptions',
    summary: 'The G20 trade summit concluded with a joint declaration outlining coordinated measures to address persistent supply chain disruptions affecting global commerce. Leaders from G20 nations proposed a coordinated response to ongoing logistics challenges.',
    source: 'Financial Times',
    sourceFavicon: '🟡',
    author: 'Amara Osei',
    timeAgo: '12h ago',
    readTime: '4 min read',
    category: 'Finance',
    image: 'https://images.unsplash.com/photo-1431540015161-0bf868a2d407?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMG1lZXRpbmclMjBjb25mZXJlbmNlfGVufDF8fHx8MTc3MDUyMjE2Mnww&ixlib=rb-4.1.0&q=80&w=1080',
    imageCredit: 'FT',
    entities: [
      {
        id: 'e12',
        text: 'G20',
        type: 'organization',
        priority: 'medium',
        context: 'The G20 (Group of Twenty) is an international forum comprising 19 countries and the EU, representing the world\'s major economies. It addresses key issues related to global economic stability.',
        mentionCount: 5,
        inTitle: false
      }
    ],
    content: `The <entity id="e12" priority="medium">G20</entity> trade summit concluded with a joint declaration outlining coordinated measures to address persistent supply chain disruptions affecting global commerce.`
  }
];

export const categories = [
  'My Feed',
  'Technology',
  'Finance',
  'World',
  'Health',
  'Timelines'
];