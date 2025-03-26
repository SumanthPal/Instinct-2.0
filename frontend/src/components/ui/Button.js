// components/ui/Button.js
import { forwardRef } from 'react';
import { classNames } from '@/lib/utils';

const Button = forwardRef(function Button(props, ref) {
  const {
    type = 'button',
    className = '',
    variant = 'primary',
    size = 'md',
    ...rest
  } = props;

  const baseStyles = 'inline-flex items-center justify-center border font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2';
  const variantStyles = {
    primary: 'bg-blue-600 text-white border-transparent hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-600 text-white border-transparent hover:bg-gray-700 focus:ring-gray-500',
    outline: 'bg-transparent text-gray-700 border-gray-300 hover:bg-gray-50 focus:ring-blue-500',
  };
  const sizeStyles = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const classes = classNames(
    baseStyles,
    variantStyles[variant],
    sizeStyles[size],
    className
  );

  return (
    <button
      type={type}
      className={classes}
      ref={ref}
      {...rest}
    />
  );
});

export default Button;