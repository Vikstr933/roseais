interface PreviewPaneProps {
  code: string;
}

export const PreviewPane = ({ code }: PreviewPaneProps) => {
  return (
    <iframe
      className="w-full h-full"
      srcDoc={`
        <!DOCTYPE html>
        <html>
          <head>
            <style>body { margin: 0; }</style>
          </head>
          <body>
            <div id="root"></div>
            <script type="module">
              ${code}
            </script>
          </body>
        </html>
      `}
    />
  );
};
