interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'buddy';
  children: React.ReactNode;
}

export function Button({ 
  variant = 'primary', 
  children, 
  className = '', 
  ...props 
}: ButtonProps) {
  const baseStyles = 'px-4 py-2 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500';
  
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    outline: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
    buddy: 'buddy-button',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
