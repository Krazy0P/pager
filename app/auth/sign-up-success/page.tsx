import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Page() {
  return (
    <div className="flex w-full justify-center">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">
                Check your inbox
              </CardTitle>
              <CardDescription>One more step to finish signing up</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                We sent you a confirmation link. Open it to activate your account,
                then sign in.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
