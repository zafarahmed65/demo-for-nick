import { StoreProvider } from "@/lib/store";
import { Shell } from "@/components/shell";

export default function Page() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
