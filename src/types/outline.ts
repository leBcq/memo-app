export type OutlineNode = {
  id: string;
  contentHtml: string;
  collapsed: boolean;
  children: OutlineNode[];
};

export type OutlineState = {
  nodes: OutlineNode[];
};
