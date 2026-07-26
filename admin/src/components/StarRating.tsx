import React from 'react';
import { Star } from 'lucide-react';
import clsx from 'clsx';

interface StarRatingProps {
  rating: number;
  max?: number;
  size?: number;
  editable?: boolean;
  onChange?: (rating: number) => void;
  className?: string;
}

const StarRating: React.FC<StarRatingProps> = ({
  rating,
  max = 5,
  size = 20,
  editable = false,
  onChange,
  className
}) => {
  const [hoverRating, setHoverRating] = React.useState<number | null>(null);

  const handleClick = (val: number) => {
    if (editable && onChange) {
      onChange(val);
    }
  };

  const handleMouseEnter = (val: number) => {
    if (editable) {
      setHoverRating(val);
    }
  };

  const handleMouseLeave = () => {
    if (editable) {
      setHoverRating(null);
    }
  };

  return (
    <div className={clsx("flex items-center gap-1", className)}>
      {Array.from({ length: max }, (_, i) => i + 1).map((star) => {
        const isActive = hoverRating !== null ? star <= hoverRating : star <= rating;
        return (
          <Star
            key={star}
            size={size}
            className={clsx(
              "transition-colors",
              isActive ? "fill-amber-400 text-amber-400" : "text-slate-300",
              editable && "cursor-pointer"
            )}
            onClick={() => handleClick(star)}
            onMouseEnter={() => handleMouseEnter(star)}
            onMouseLeave={handleMouseLeave}
          />
        );
      })}
    </div>
  );
};

export default StarRating;
