import type { ElementType, ComponentPropsWithoutRef, ReactNode } from "react";

type CardOwnProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  className?: string;
  padding?: string;
};

type CardProps<T extends ElementType> = CardOwnProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof CardOwnProps<T>>;

export function Card<T extends ElementType = "div">({
  as,
  children,
  className = "",
  padding = "p-6",
  ...rest
}: CardProps<T>) {
  const Component = as || "div";
  return (
    <Component className={`surface rounded-2xl ${padding} ${className}`} {...rest}>
      {children}
    </Component>
  );
}
