type Props = { onClick: () => void };

export default function BackButton({ onClick }: Props) {
  return (
    <button onClick={onClick} className="btn btn-ghost" type="button">
      Geri Don
    </button>
  );
}