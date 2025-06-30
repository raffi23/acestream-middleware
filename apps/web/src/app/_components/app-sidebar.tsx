import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { generateVLCLink } from "@/lib/utils";
import { StreamGroup } from "@/types";
import { ChevronDownIcon } from "lucide-react";
import { FC, PropsWithChildren } from "react";
import CopyButton from "./copy-button";

interface Props extends PropsWithChildren {
  streamGroups: StreamGroup[];
}

const AppSidebar: FC<Props> = ({ streamGroups, children }) => {
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
          {streamGroups.map((group) => (
            <Collapsible key={group.category} className="group/collapsible">
              <SidebarGroup>
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger className="capitalize">
                    {group.category}

                    <ChevronDownIcon className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>

                <CollapsibleContent asChild>
                  <SidebarGroupContent>
                    {group.channels?.map((channel) => (
                      <CopyButton
                        key={channel.infohash}
                        data={generateVLCLink(channel.infohash)}
                      >
                        <SidebarMenuButton>{channel.name}</SidebarMenuButton>
                      </CopyButton>
                    ))}
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          ))}
        </SidebarContent>
      </Sidebar>

      <main className="w-full">
        <header className="border-b bg-sidebar flex items-center gap-6 p-3">
          <SidebarTrigger />
        </header>

        <div className="p-4 min-h-[calc(100vh_-_3.3125rem)]">{children}</div>
      </main>
    </SidebarProvider>
  );
};

export default AppSidebar;
