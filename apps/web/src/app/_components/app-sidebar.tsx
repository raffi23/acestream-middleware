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
import { StreamGroup } from "@/types";
import { ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import React, { FC, PropsWithChildren } from "react";
import AppSearch from "./app-search";

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
                      <SidebarMenuButton key={channel.infohash} asChild>
                        <Link href={``}>{channel.name}</Link>
                      </SidebarMenuButton>
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
          <AppSearch />
        </header>

        <div className="p-4">{children}</div>
      </main>
    </SidebarProvider>
  );
};

export default AppSidebar;
