"use client";

import { CopyIcon, SearchIcon, Trash2Icon } from "lucide-react";

import { useDashboardState } from "@/components/dashboard/dashboard-state-provider";
import {
  formatTimestamp,
  USERS_PAGE_SIZE,
} from "@/components/dashboard/dashboard-shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function UsersDashboardClient() {
  const {
    loadingMailboxes,
    usersSearchQuery,
    setUsersSearchQuery,
    usersStatusFilter,
    setUsersStatusFilter,
    usersUnreadOnly,
    setUsersUnreadOnly,
    usersPage,
    setUsersPage,
    filteredUsers,
    usersTotalPages,
    paginatedUsers,
    createUserSheetOpen,
    setCreateUserSheetOpen,
    createUserForm,
    setCreateUserForm,
    generatedMailboxEmail,
    busyAction,
    handleCreateUserSubmit,
    handleCopyPassword,
    handleDeleteMailbox,
    openCreateUserSheet,
  } = useDashboardState();

  return (
    <div className="flex-1 space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Users Directory</CardTitle>
              <CardDescription>
                Mailboxes are treated as users. Filter, paginate, and manage
                user mailboxes.
              </CardDescription>
            </div>

            <Button onClick={openCreateUserSheet}>Create New</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[240px] flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={usersSearchQuery}
                onChange={(event) => setUsersSearchQuery(event.target.value)}
                className="pl-9"
                placeholder="Search by name, passport ID, email, or user ID"
              />
            </div>

            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant={usersStatusFilter === "all" ? "default" : "outline"}
                onClick={() => setUsersStatusFilter("all")}
              >
                All
              </Button>
              <Button
                size="sm"
                variant={usersStatusFilter === "active" ? "default" : "outline"}
                onClick={() => setUsersStatusFilter("active")}
              >
                Active
              </Button>
              <Button
                size="sm"
                variant={
                  usersStatusFilter === "inactive" ? "default" : "outline"
                }
                onClick={() => setUsersStatusFilter("inactive")}
              >
                Inactive
              </Button>
            </div>

            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={usersUnreadOnly}
                onChange={(event) => setUsersUnreadOnly(event.target.checked)}
              />
              Unread only
            </label>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-700 p-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Passport ID</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Inbox</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingMailboxes ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-16 text-center text-zinc-600"
                    >
                      Loading users...
                    </TableCell>
                  </TableRow>
                ) : paginatedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-16 text-center text-zinc-600"
                    >
                      No users match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedUsers.map((mailbox) => (
                    <TableRow key={mailbox.id}>
                      <TableCell className="max-w-[220px] truncate font-medium">
                        {mailbox.label || mailbox.emailAddress.split("@")[0]}
                      </TableCell>
                      <TableCell>{mailbox.passportId}</TableCell>
                      <TableCell className="max-w-[240px] truncate">
                        {mailbox.emailAddress}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={mailbox.isActive ? "default" : "outline"}
                        >
                          {mailbox.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>{mailbox.inboxCount}</TableCell>
                      <TableCell>{mailbox.sentCount}</TableCell>
                      <TableCell>
                        {formatTimestamp(mailbox.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCopyPassword(mailbox.id)}
                            disabled={busyAction === `reveal-${mailbox.id}`}
                          >
                            <CopyIcon />
                            Copy Password
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => void handleDeleteMailbox(mailbox)}
                            disabled={busyAction === `delete-${mailbox.id}`}
                          >
                            <Trash2Icon />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-600">
            <span>
              Showing{" "}
              {filteredUsers.length === 0
                ? 0
                : (usersPage - 1) * USERS_PAGE_SIZE + 1}
              -{(usersPage - 1) * USERS_PAGE_SIZE + paginatedUsers.length} of{" "}
              {filteredUsers.length}
            </span>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={usersPage <= 1}
                onClick={() =>
                  setUsersPage((previous) => Math.max(1, previous - 1))
                }
              >
                Previous
              </Button>
              <span>
                Page {usersPage} of {usersTotalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={usersPage >= usersTotalPages}
                onClick={() =>
                  setUsersPage((previous) =>
                    Math.min(usersTotalPages, previous + 1),
                  )
                }
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <Sheet open={createUserSheetOpen} onOpenChange={setCreateUserSheetOpen}>
        <SheetContent side="left" className="w-full sm:max-w-md">
          <form
            className="flex h-full flex-col"
            onSubmit={handleCreateUserSubmit}
          >
            <SheetHeader>
              <SheetTitle>Create New User</SheetTitle>
              <SheetDescription>
                Create a mailbox-user using name and passport ID. The email is
                generated automatically.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-3 px-4">
              <div className="space-y-1.5">
                <Label htmlFor="create-user-name">Nickname / Name</Label>
                <Input
                  id="create-user-name"
                  value={createUserForm.name}
                  onChange={(event) =>
                    setCreateUserForm((previous) => ({
                      ...previous,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Ananya Sharma"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-user-passport">Passport ID</Label>
                <Input
                  id="create-user-passport"
                  value={createUserForm.passportId}
                  onChange={(event) =>
                    setCreateUserForm((previous) => ({
                      ...previous,
                      passportId: event.target.value,
                    }))
                  }
                  placeholder="P1234567"
                  required
                />
              </div>

              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                Generated mailbox:{" "}
                {generatedMailboxEmail || "Fill name and passport ID"}
              </div>
            </div>

            <SheetFooter>
              <Button
                type="submit"
                disabled={
                  busyAction === "create-user" || !generatedMailboxEmail
                }
              >
                {busyAction === "create-user" ? "Creating..." : "Create User"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateUserSheetOpen(false)}
              >
                Cancel
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
