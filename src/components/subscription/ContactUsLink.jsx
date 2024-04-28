const ContactUsLink = (props) => {
  return (
    <a
      className="mt-2 block w-full bg-blue-500 border border-transparent rounded-md py-2 text-sm text-center hover:no-underline"
      href="https://zenuml.com/docs/about/contact-us"
      target="_blank"
    >
      {props.upgradeBtnName}
    </a>
  );
};

export { ContactUsLink };
