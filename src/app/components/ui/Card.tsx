interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`buddy-card p-6 ${className}`}>
      {children}
    </div>
  );
}
