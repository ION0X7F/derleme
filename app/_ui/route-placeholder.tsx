import type { ReactNode } from "react";

type RoutePlaceholderProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

export default function RoutePlaceholder(_props: RoutePlaceholderProps) {
  void _props;
  return null;
}
