interface ContactAvatarProps {
  name: string;
  image?: string;
  color?: string;
  onClick?: () => void;
}

const colors = [
  "from-primary to-blue-400",
  "from-emerald-500 to-teal-400",
  "from-orange-500 to-amber-400",
  "from-pink-500 to-rose-400",
  "from-violet-500 to-purple-400",
  "from-cyan-500 to-sky-400",
];

const ContactAvatar = ({ name, image, onClick }: ContactAvatarProps) => {
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2);
  const colorIdx = name.charCodeAt(0) % colors.length;

  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 min-w-[68px] group">
      <div className="relative">
        <div className={`w-14 h-14 rounded-full overflow-hidden flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow duration-200 group-active:scale-95 ${
          image ? '' : `bg-gradient-to-br ${colors[colorIdx]}`
        }`}>
          {image ? (
            <img src={image} alt={name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-base font-semibold text-primary-foreground">{initials}</span>
          )}
        </div>
      </div>
      <span className="text-[11px] font-medium text-foreground/70 text-center w-full truncate">{name}</span>
    </button>
  );
};

export default ContactAvatar;
