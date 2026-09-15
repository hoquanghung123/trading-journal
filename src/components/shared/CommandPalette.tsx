import { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  PAGE_TITLES,
  navigateToPage,
  requestNewTrade,
  type PageId,
} from "@/lib/nav-bus";
import {
  BookOpen,
  Brain,
  CalendarCheck,
  Crosshair,
  FileText,
  Flame,
  LayoutDashboard,
  Plus,
  UserCircle,
} from "lucide-react";

const PAGES: { id: PageId; icon: typeof Crosshair }[] = [
  { id: "bias", icon: Crosshair },
  { id: "trades", icon: FileText },
  { id: "playbook", icon: BookOpen },
  { id: "review", icon: CalendarCheck },
  { id: "dashboard", icon: LayoutDashboard },
  { id: "psychology", icon: Brain },
  { id: "progress", icon: Flame },
  { id: "account", icon: UserCircle },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key.toLowerCase() === "n" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        requestNewTrade();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump to a page or run an action…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => {
              setOpen(false);
              requestNewTrade();
            }}
          >
            <Plus className="w-4 h-4" />
            New trade
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Pages">
          {PAGES.map((p) => {
            const Icon = p.icon;
            return (
              <CommandItem
                key={p.id}
                onSelect={() => {
                  setOpen(false);
                  navigateToPage(p.id);
                }}
              >
                <Icon className="w-4 h-4" />
                {PAGE_TITLES[p.id]}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
